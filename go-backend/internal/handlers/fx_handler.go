package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

// GetFXRates returns all currently cached exchange rates
func GetFXRates(c *gin.Context) {
	baseCurrency := c.DefaultQuery("base", "USD")
	baseCurrency = strings.ToUpper(strings.TrimSpace(baseCurrency))

	var rates []models.ExchangeRate
	database.DB.Where("base_currency = ?", baseCurrency).Order("target_currency ASC").Find(&rates)

	var lastUpdated *time.Time
	if len(rates) > 0 {
		lastUpdated = &rates[0].LastUpdated
	}

	c.JSON(http.StatusOK, gin.H{
		"base_currency": baseCurrency,
		"last_updated":  lastUpdated,
		"rates":         rates,
	})
}

// SyncFXRatesHandler manually triggers live synchronization of exchange rates
func SyncFXRatesHandler(c *gin.Context) {
	if err := services.SyncFXRates(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Exchange rates updated successfully",
		"synced_at": time.Now(),
	})
}

type OverrideFXRequest struct {
	BaseCurrency   string  `json:"base_currency" binding:"required"`
	TargetCurrency string  `json:"target_currency" binding:"required"`
	Rate           float64 `json:"rate" binding:"required,gt=0"`
}

// OverrideFXRateHandler allows setting a custom exchange rate manually
func OverrideFXRateHandler(c *gin.Context) {
	var req OverrideFXRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	base := strings.ToUpper(strings.TrimSpace(req.BaseCurrency))
	target := strings.ToUpper(strings.TrimSpace(req.TargetCurrency))

	rateRecord := models.ExchangeRate{
		BaseCurrency:     base,
		TargetCurrency:   target,
		Rate:             req.Rate,
		LastUpdated:      time.Now(),
		Source:           "MANUAL_OVERRIDE",
		IsManualOverride: true,
	}

	database.DB.Where("base_currency = ? AND target_currency = ?", base, target).
		Assign(rateRecord).
		FirstOrCreate(&rateRecord)

	c.JSON(http.StatusOK, gin.H{
		"message": "Custom exchange rate saved",
		"rate":    rateRecord,
	})
}
