package handlers

import (
	"net/http"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

// GetProfitAndLoss handles Income Statement generation
func GetProfitAndLoss(c *gin.Context) {
	unitID := c.Query("unit_id")
	fromStr := c.DefaultQuery("from", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))
	toStr := c.DefaultQuery("to", time.Now().Format("2006-01-02"))

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		from = time.Now().AddDate(0, -1, 0)
	}

	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		to = time.Now()
	}
	// Inclusive end of day
	to = to.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	report := services.GenerateProfitAndLoss(unitID, from, to)
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// GetBalanceSheet handles Balance Sheet generation
func GetBalanceSheet(c *gin.Context) {
	unitID := c.Query("unit_id")
	asOfStr := c.DefaultQuery("as_of", time.Now().Format("2006-01-02"))

	asOf, err := time.Parse("2006-01-02", asOfStr)
	if err != nil {
		asOf = time.Now()
	}
	asOf = asOf.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	report := services.GenerateBalanceSheet(unitID, asOf)
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// GetTrialBalance handles Trial Balance validation
func GetTrialBalance(c *gin.Context) {
	unitID := c.Query("unit_id")
	fromStr := c.DefaultQuery("from", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))
	toStr := c.DefaultQuery("to", time.Now().Format("2006-01-02"))

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		from = time.Now().AddDate(0, -1, 0)
	}

	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		to = time.Now()
	}
	to = to.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	report := services.GenerateTrialBalance(unitID, from, to)
	c.JSON(http.StatusOK, gin.H{"data": report})
}

// GetAccountsList returns the Chart of Accounts list
func GetAccountsList(c *gin.Context) {
	services.SeedChartOfAccounts()
	var accounts []models.Account
	database.DB.Order("code ASC").Find(&accounts)
	c.JSON(http.StatusOK, gin.H{"data": accounts})
}

// RebuildJournalsHandler triggers seamless retro-active ledger sync
func RebuildJournalsHandler(c *gin.Context) {
	services.RebuildAllJournals()
	c.JSON(http.StatusOK, gin.H{
		"message":   "Double-entry journal records synchronized with all invoices and expenses",
		"synced_at": time.Now(),
	})
}
