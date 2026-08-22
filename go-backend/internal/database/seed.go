package database

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/anirban-guha/invoicecore/internal/models"
)

type apiResponse struct {
	Error bool            `json:"error"`
	Data  json.RawMessage `json:"data"`
}

type apiCurrency struct {
	Name     string `json:"name"`
	Currency string `json:"currency"`
	ISO2     string `json:"iso2"`
	ISO3     string `json:"iso3"`
}

type apiCountryStates struct {
	Name   string `json:"name"`
	ISO2   string `json:"iso2"`
	ISO3   string `json:"iso3"`
	States []struct {
		Name      string `json:"name"`
		StateCode string `json:"state_code"`
	} `json:"states"`
}

func SeedIfNeeded() {
	seedBusinessUnits()

	var count int64
	DB.Model(&models.State{}).Count(&count)
	if count > 0 {
		return // Already seeded
	}

	log.Println("🌱 Starting Background Database Seeding (States/Countries)...")

	// Run Indian States seeding synchronously (very fast)
	seedIndianStates()

	// Run Global seeding asynchronously
	go func() {
		seedGlobalData()
		log.Println("✅ Background Seeding Process Complete.")
	}()
}

func seedBusinessUnits() {
	var count int64
	DB.Model(&models.BusinessUnit{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("🏢 Initializing default primary business unit...")

	defaultBU := models.BusinessUnit{
		ID:              "primary",
		Code:            "ORG",
		Name:            "My Company",
		Category:        "General Business",
		Description:     "Primary workspace for invoicing, accounting and operations",
		InvoicePrefix:   "INV-",
		QuotationPrefix: "QT-",
		ActiveModules:   models.JSONArray{"core", "3d", "software", "ecommerce"},
		Currency:        "INR",
		IsDefault:       true,
	}

	DB.Create(&defaultBU)
}

func seedIndianStates() {
	indianStates := []models.State{
		{Code: 1, Name: "Jammu & Kashmir", Country: "India"},
		{Code: 2, Name: "Himachal Pradesh", Country: "India"},
		{Code: 3, Name: "Punjab", Country: "India"},
		{Code: 4, Name: "Chandigarh", Country: "India"},
		{Code: 5, Name: "Uttarakhand", Country: "India"},
		{Code: 6, Name: "Haryana", Country: "India"},
		{Code: 7, Name: "Delhi", Country: "India"},
		{Code: 8, Name: "Rajasthan", Country: "India"},
		{Code: 9, Name: "Uttar Pradesh", Country: "India"},
		{Code: 10, Name: "Bihar", Country: "India"},
		{Code: 11, Name: "Sikkim", Country: "India"},
		{Code: 12, Name: "Arunachal Pradesh", Country: "India"},
		{Code: 13, Name: "Nagaland", Country: "India"},
		{Code: 14, Name: "Manipur", Country: "India"},
		{Code: 15, Name: "Mizoram", Country: "India"},
		{Code: 16, Name: "Tripura", Country: "India"},
		{Code: 17, Name: "Meghalaya", Country: "India"},
		{Code: 18, Name: "Assam", Country: "India"},
		{Code: 19, Name: "West Bengal", Country: "India"},
		{Code: 20, Name: "Jharkhand", Country: "India"},
		{Code: 21, Name: "Odisha", Country: "India"},
		{Code: 22, Name: "Chhattisgarh", Country: "India"},
		{Code: 23, Name: "Madhya Pradesh", Country: "India"},
		{Code: 24, Name: "Gujarat", Country: "India"},
		{Code: 25, Name: "Daman & Diu", Country: "India"},
		{Code: 26, Name: "Dadra & Nagar Haveli", Country: "India"},
		{Code: 27, Name: "Maharashtra", Country: "India"},
		{Code: 29, Name: "Karnataka", Country: "India"},
		{Code: 30, Name: "Goa", Country: "India"},
		{Code: 31, Name: "Lakshadweep", Country: "India"},
		{Code: 32, Name: "Kerala", Country: "India"},
		{Code: 33, Name: "Tamil Nadu", Country: "India"},
		{Code: 34, Name: "Puducherry", Country: "India"},
		{Code: 35, Name: "Andaman & Nicobar Islands", Country: "India"},
		{Code: 36, Name: "Telangana", Country: "India"},
		{Code: 37, Name: "Andhra Pradesh", Country: "India"},
		{Code: 38, Name: "Ladakh", Country: "India"},
		{Code: 97, Name: "Other Territory", Country: "India"},
		{Code: 99, Name: "International / Export", Country: "India"},
	}

	log.Printf("... Syncing %d Indian GST States", len(indianStates))
	for _, s := range indianStates {
		result := DB.Where("code = ?", s.Code).
			Assign(models.State{Name: s.Name, Country: s.Country}).
			FirstOrCreate(&s)
		if result.Error != nil {
			log.Printf("  ❌ Failed to seed state %s: %v", s.Name, result.Error)
		}
	}
}

func seedGlobalData() {
	log.Println("... Fetching Live Data from CountriesNow API")

	// Fetch currencies
	currencyMap := make(map[string]string)
	isoMap := make(map[string]string)

	currencyData, err := fetchAPI("https://countriesnow.space/api/v0.1/countries/currency")
	if err != nil {
		log.Printf("❌ Currency API failed: %v", err)
		return
	}

	var currencies []apiCurrency
	if err := json.Unmarshal(currencyData, &currencies); err != nil {
		log.Printf("❌ Failed to parse currencies: %v", err)
		return
	}

	for _, c := range currencies {
		currencyMap[c.Name] = c.Currency
		isoMap[c.Name] = c.ISO2
	}

	// Fetch states
	stateData, err := fetchAPI("https://countriesnow.space/api/v0.1/countries/states")
	if err != nil {
		log.Printf("❌ States API failed: %v", err)
		return
	}

	var countries []apiCountryStates
	if err := json.Unmarshal(stateData, &countries); err != nil {
		log.Printf("❌ Failed to parse countries: %v", err)
		return
	}

	globalStateIDCounter := 1000
	log.Printf("... Processing %d Countries", len(countries))

	for _, country := range countries {
		currency := currencyMap[country.Name]
		if currency == "" {
			currency = "USD"
		}
		isoCode := isoMap[country.Name]
		if isoCode == "" {
			isoCode = country.ISO2
		}
		if isoCode == "" && len(country.Name) >= 2 {
			isoCode = strings.ToUpper(country.Name[:2])
		}

		if isoCode != "" && len(isoCode) <= 5 {
			c := models.Country{
				ISOCode:  isoCode,
				Name:     country.Name,
				Currency: &currency,
			}
			DB.Where("iso_code = ?", isoCode).
				Assign(models.Country{Name: country.Name, Currency: &currency}).
				FirstOrCreate(&c)
		}

		if country.Name != "India" && len(country.States) > 0 {
			for _, state := range country.States {
				var existing models.State
				result := DB.Where("name = ? AND country = ?", state.Name, country.Name).First(&existing)
				if result.RowsAffected == 0 {
					DB.Create(&models.State{
						Code:    globalStateIDCounter,
						Name:    state.Name,
						Country: country.Name,
					})
					globalStateIDCounter++
				}
			}
		}
	}
	log.Println("✅ Global Data Seeded Successfully")
}

func fetchAPI(url string) (json.RawMessage, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var apiResp apiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse API response: %w", err)
	}

	if apiResp.Error {
		return nil, fmt.Errorf("API returned error")
	}

	return apiResp.Data, nil
}
