package handlers

import (
	"net/http"
	"time"

	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

// GetNotificationSettingsHandler returns current notification channels
func GetNotificationSettingsHandler(c *gin.Context) {
	cfg := services.GetNotificationConfig()
	c.JSON(http.StatusOK, gin.H{"data": cfg})
}

// SaveNotificationSettingsHandler updates notification channel credentials and toggles
func SaveNotificationSettingsHandler(c *gin.Context) {
	var req services.NotificationConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := services.SaveNotificationConfig(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save notification settings: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Notification channels updated successfully",
		"data":    req,
	})
}

type TestAlertRequest struct {
	Channel string `json:"channel"` // "all", "telegram", "discord", "whatsapp", "webhook"
}

// SendTestAlertHandler dispatches an instant test notification
func SendTestAlertHandler(c *gin.Context) {
	var req TestAlertRequest
	_ = c.ShouldBindJSON(&req)

	payload := services.AlertPayload{
		Type:      services.AlertEventTest,
		Title:     "🧪 NexusCore ERP Alert System Test",
		Message:   "This is a test alert verifying your webhook and push notification setup. All systems are operational!",
		Severity:  "SUCCESS",
		Timestamp: time.Now(),
		Details: map[string]interface{}{
			"test_channel": req.Channel,
			"environment":  "Production",
			"status":       "Online & Verified",
		},
	}

	services.DispatchAlert(payload)

	c.JSON(http.StatusOK, gin.H{
		"message": "Test alert dispatched to configured notification channels",
		"payload": payload,
	})
}
