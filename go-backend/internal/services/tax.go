package services

import (
	"fmt"
	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

const DefaultGSTRate = 18.0

type TaxBreakdown struct {
	TaxType string             `json:"tax_type"`
	Rate    float64            `json:"rate"` // Kept for backwards compatibility
	Amount  float64            `json:"amount"`
	Taxes   map[string]float64 `json:"taxes,omitempty"`
}

// CalculateTax applies dynamic tax layers defined in TAX_SETTINGS
func CalculateTax(subtotal float64) TaxBreakdown {
	if !database.IsConnected() {
		return TaxBreakdown{TaxType: "NONE", Amount: 0, Taxes: make(map[string]float64)}
	}

	var settings []models.SystemSetting
	database.DB.Where("key = ?", "TAX_SETTINGS").Limit(1).Find(&settings)
	
	if len(settings) == 0 || settings[0].JSONValue == nil {
		return TaxBreakdown{TaxType: "NONE", Amount: 0, Taxes: make(map[string]float64)}
	}

	jsonVal := *settings[0].JSONValue
	layersInter, ok := jsonVal["layers"].([]interface{})
	if !ok {
		return TaxBreakdown{TaxType: "NONE", Amount: 0, Taxes: make(map[string]float64)}
	}

	totalAmount := 0.0
	taxes := make(map[string]float64)

	for _, item := range layersInter {
		if m, ok := item.(map[string]interface{}); ok {
			name, _ := m["name"].(string)
			rateInter, _ := m["rate"]
			
			var rate float64
			switch v := rateInter.(type) {
			case float64:
				rate = v
			case int:
				rate = float64(v)
			}
			
			if name != "" && rate > 0 {
				amt := subtotal * rate / 100.0
				taxes[fmt.Sprintf("%s (%.1f%%)", name, rate)] = amt
				totalAmount += amt
			}
		}
	}

	taxType := "DYNAMIC"
	if totalAmount == 0 {
		taxType = "NONE"
	}

	return TaxBreakdown{
		TaxType: taxType,
		Amount:  totalAmount,
		Taxes:   taxes,
	}
}

// GetCompanyStateCode retrieves the company's state code from settings
func GetCompanyStateCode() *int {
	if !database.IsConnected() {
		return nil
	}

	var settings []models.SystemSetting
	// Use Find (not First) to avoid GORM logging "record not found" when profile isn't saved yet
	database.DB.Where("key = ?", "COMPANY_PROFILE").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].JSONValue == nil {
		return nil
	}

	jsonVal := *settings[0].JSONValue
	if stateCode, ok := jsonVal["state_code"]; ok {
		if code, ok := stateCode.(float64); ok {
			intCode := int(code)
			return &intCode
		}
	}
	return nil
}
