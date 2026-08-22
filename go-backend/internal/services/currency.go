package services

import (
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
