package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

// GetBaseCurrency retrieves the company's base currency from settings
func GetBaseCurrency() string {
	if !database.IsConnected() {
		return "INR"
	}

	var settings []models.SystemSetting
	database.DB.Where("key = ?", "LOCALIZATION").Limit(1).Find(&settings)
	if len(settings) > 0 && settings[0].JSONValue != nil {
		jsonVal := *settings[0].JSONValue
		if base, ok := jsonVal["base_currency"].(string); ok && base != "" {
			return base
		}
	}
	return "INR"
}

type FrankfurterResponse struct {
	Amount float64            `json:"amount"`
	Base   string             `json:"base"`
	Date   string             `json:"date"`
	Rates  map[string]float64 `json:"rates"`
}

// GetExchangeRate queries frankfurter.app for live exchange rates.
// Example: from = "USD", to = "INR" returns how many INR per 1 USD.
func GetExchangeRate(fromCurrency, toCurrency string) (float64, error) {
	if fromCurrency == toCurrency {
		return 1.0, nil
	}

	url := fmt.Sprintf("https://api.frankfurter.app/latest?from=%s&to=%s", fromCurrency, toCurrency)
	
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 1.0, fmt.Errorf("failed to fetch exchange rate: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 1.0, fmt.Errorf("exchange rate api returned status: %d", resp.StatusCode)
	}

	var result FrankfurterResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 1.0, fmt.Errorf("failed to decode exchange rate response: %w", err)
	}

	if rate, ok := result.Rates[toCurrency]; ok {
		return rate, nil
	}

	return 1.0, fmt.Errorf("rate for %s not found in response", toCurrency)
}
