package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

type FXResponse struct {
	Result          string             `json:"result"`
	BaseCode        string             `json:"base_code"`
	TimeLastUpdate  int64              `json:"time_last_update_unix"`
	Rates           map[string]float64 `json:"rates"`
}

// TrackedCurrencies are the primary business currencies supported by NexusCore ERP
var TrackedCurrencies = []string{"USD", "INR", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "JPY"}

// SyncFXRates fetches live exchange rates from open exchange API and updates the database
func SyncFXRates() error {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://open.er-api.com/v6/latest/USD")
	if err != nil {
		return fmt.Errorf("failed to fetch exchange rates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("exchange rate provider returned status: %d", resp.StatusCode)
	}

	var fxData FXResponse
	if err := json.NewDecoder(resp.Body).Decode(&fxData); err != nil {
		return fmt.Errorf("failed to decode exchange rate response: %w", err)
	}

	usdRates := fxData.Rates
	usdInr, ok := usdRates["INR"]
	if !ok || usdInr == 0 {
		usdInr = 87.50 // Safe fallback
	}

	now := time.Now()

	// Update USD as Base rates
	for _, target := range TrackedCurrencies {
		rate, exists := usdRates[target]
		if !exists || rate <= 0 {
			continue
		}

		var existing models.ExchangeRate
		err := database.DB.Where("base_currency = ? AND target_currency = ?", "USD", target).First(&existing).Error
		if err == nil && existing.IsManualOverride {
			continue // Preserve user manual override
		}

		exchangeRate := models.ExchangeRate{
			BaseCurrency:     "USD",
			TargetCurrency:   target,
			Rate:             rate,
			LastUpdated:      now,
			Source:           "OPEN_EXCHANGE",
			IsManualOverride: false,
		}

		database.DB.Where("base_currency = ? AND target_currency = ?", "USD", target).
			Assign(exchangeRate).
			FirstOrCreate(&exchangeRate)
	}

	// Also generate INR as Base rates (crucial for domestic Indian ERP / GST books)
	for _, target := range TrackedCurrencies {
		targetRateInUSD, exists := usdRates[target]
		if !exists || targetRateInUSD <= 0 {
			continue
		}

		// Rate of 1 INR in Target Currency = (Target in USD) / (INR in USD)
		rateFromINR := targetRateInUSD / usdInr

		var existing models.ExchangeRate
		err := database.DB.Where("base_currency = ? AND target_currency = ?", "INR", target).First(&existing).Error
		if err == nil && existing.IsManualOverride {
			continue
		}

		inrRate := models.ExchangeRate{
			BaseCurrency:     "INR",
			TargetCurrency:   target,
			Rate:             rateFromINR,
			LastUpdated:      now,
			Source:           "OPEN_EXCHANGE",
			IsManualOverride: false,
		}

		database.DB.Where("base_currency = ? AND target_currency = ?", "INR", target).
			Assign(inrRate).
			FirstOrCreate(&inrRate)
	}

	log.Println("[FX Service] Live exchange rates synchronized successfully.")
	return nil
}

// GetExchangeRate retrieves the current exchange rate from base to target
func GetExchangeRate(baseCur, targetCur string) (float64, error) {
	baseCur = strings.ToUpper(strings.TrimSpace(baseCur))
	targetCur = strings.ToUpper(strings.TrimSpace(targetCur))

	if baseCur == targetCur {
		return 1.0, nil
	}

	var exRate models.ExchangeRate
	err := database.DB.Where("base_currency = ? AND target_currency = ?", baseCur, targetCur).First(&exRate).Error
	if err == nil && exRate.Rate > 0 {
		return exRate.Rate, nil
	}

	// Try inverse
	var inverseRate models.ExchangeRate
	err = database.DB.Where("base_currency = ? AND target_currency = ?", targetCur, baseCur).First(&inverseRate).Error
	if err == nil && inverseRate.Rate > 0 {
		return 1.0 / inverseRate.Rate, nil
	}

	// Fallback standard default multipliers
	fallbacks := map[string]float64{
		"USD_INR": 87.50,
		"INR_USD": 0.0114,
		"EUR_INR": 95.20,
		"INR_EUR": 0.0105,
		"GBP_INR": 111.30,
		"INR_GBP": 0.0089,
		"AED_INR": 23.82,
		"INR_AED": 0.042,
		"CAD_INR": 62.40,
		"AUD_INR": 56.80,
	}

	pairKey := fmt.Sprintf("%s_%s", baseCur, targetCur)
	if val, ok := fallbacks[pairKey]; ok {
		return val, nil
	}

	return 1.0, nil
}

// ConvertCurrency converts an amount from source currency to destination currency
func ConvertCurrency(amount float64, fromCur, toCur string) float64 {
	rate, err := GetExchangeRate(fromCur, toCur)
	if err != nil || rate <= 0 {
		return amount
	}
	return amount * rate
}

// StartFXBackgroundSync starts a background goroutine syncing rates daily
func StartFXBackgroundSync() {
	go func() {
		// Initial sync with small delay after startup
		time.Sleep(5 * time.Second)
		if err := SyncFXRates(); err != nil {
			log.Printf("[FX Service] Initial sync error: %v", err)
		}

		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			if err := SyncFXRates(); err != nil {
				log.Printf("[FX Service] Periodic sync error: %v", err)
			}
		}
	}()
}
