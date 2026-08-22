package handlers

import (
	"net/http"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

// ListRecurringInvoices fetches all recurring invoices
func ListRecurringInvoices(c *gin.Context) {
	var subscriptions []models.RecurringInvoice
	if err := database.DB.Preload("Client").Preload("BankAccount").Find(&subscriptions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subscriptions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": subscriptions})
}

// GetRecurringInvoice fetches a single subscription
func GetRecurringInvoice(c *gin.Context) {
	id := c.Param("id")
	var sub models.RecurringInvoice
	if err := database.DB.Preload("Client").Preload("BankAccount").First(&sub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
		return
	}
	c.JSON(http.StatusOK, sub)
}

// CreateRecurringInvoice creates a new subscription
func CreateRecurringInvoice(c *gin.Context) {
	var sub models.RecurringInvoice
	if err := c.ShouldBindJSON(&sub); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&sub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription"})
		return
	}
	c.JSON(http.StatusCreated, sub)
}

// UpdateRecurringInvoice updates a subscription
func UpdateRecurringInvoice(c *gin.Context) {
	id := c.Param("id")
	var existing models.RecurringInvoice
	if err := database.DB.First(&existing, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
		return
	}

	var input models.RecurringInvoice
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	existing.ClientID = input.ClientID
	existing.BankAccountID = input.BankAccountID
	existing.Currency = input.Currency
	existing.BaseCurrency = input.BaseCurrency
	existing.ExchangeRate = input.ExchangeRate
	existing.LineItems = input.LineItems
	existing.TaxSummary = input.TaxSummary
	existing.Subtotal = input.Subtotal
	existing.GrandTotal = input.GrandTotal
	existing.Category = input.Category
	existing.Remarks = input.Remarks
	existing.Frequency = input.Frequency
	existing.NextRunDate = input.NextRunDate
	existing.AutoEmail = input.AutoEmail
	existing.Status = input.Status

	if err := database.DB.Save(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription"})
		return
	}
	c.JSON(http.StatusOK, existing)
}

// DeleteRecurringInvoice deletes a subscription
func DeleteRecurringInvoice(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.RecurringInvoice{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete subscription"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Subscription deleted successfully"})
}
