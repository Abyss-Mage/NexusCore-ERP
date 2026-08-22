package handlers

import (
	"net/http"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/license"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

type ActivateLicenseRequest struct {
	SerialKey string `json:"serial_key" binding:"required"`
}

func logLicenseActivity(c *gin.Context, action string, desc string) {
	userID, _ := getContextUserID(c)
	ip := c.ClientIP()
	entry := models.ActivityLog{
		UserID:      userID,
		Action:      action,
		Description: desc,
		IPAddress:   &ip,
	}
	database.DB.Create(&entry)
}

// GetLicenseStatus returns current licensing state, tier quotas and Safehouse Studios metadata
func GetLicenseStatus(c *gin.Context) {
	status := license.GetActiveLicense()
	c.JSON(http.StatusOK, status)
}

// ActivateLicense validates and activates a commercial serial key
func ActivateLicense(c *gin.Context) {
	var req ActivateLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Serial key is required"})
		return
	}

	updated, err := license.ActivateLicenseKey(req.SerialKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Also log to Activity Log
	logLicenseActivity(c, "ACTIVATE_LICENSE", "Commercial serial key activated: "+updated.TierLabel)

	c.JSON(http.StatusOK, gin.H{
		"message": "License successfully activated!",
		"license": updated,
	})
}

// DeactivateLicense removes the license key and safely rolls back to Community tier
func DeactivateLicense(c *gin.Context) {
	if err := license.DeactivateLicenseKey(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate license"})
		return
	}

	logLicenseActivity(c, "DEACTIVATE_LICENSE", "License deactivated, rolled back to Community tier")

	def := license.GetCommunityDefault()
	c.JSON(http.StatusOK, gin.H{
		"message": "License deactivated. System running on Free Community Edition.",
		"license": def,
	})
}
