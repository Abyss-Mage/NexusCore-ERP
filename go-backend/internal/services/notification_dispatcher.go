package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services/mqtt"
)

func init() {
	mqtt.OnAlert = func(eventType string, title string, message string, severity string, details map[string]interface{}) {
		DispatchAlert(AlertPayload{
			Type:      AlertEventType(eventType),
			Title:     title,
			Message:   message,
			Severity:  severity,
			Timestamp: time.Now(),
			Details:   details,
		})
	}
}

// AlertEventType identifies the category of notification
type AlertEventType string

const (
	AlertEventBambuFinished AlertEventType = "BAMBU_PRINT_FINISHED"
	AlertEventBambuClogged  AlertEventType = "BAMBU_NOZZLE_CLOGGED"
	AlertEventInvoicePaid   AlertEventType = "INVOICE_PAID"
	AlertEventSSLExpiring   AlertEventType = "SSL_EXPIRING"
	AlertEventTest          AlertEventType = "TEST_ALERT"
)

// AlertPayload contains rich contextual data for an alert
type AlertPayload struct {
	Type        AlertEventType         `json:"type"`
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Severity    string                 `json:"severity"` // INFO, SUCCESS, WARNING, CRITICAL
	ActionURL   string                 `json:"action_url,omitempty"`
	ChannelMask []string               `json:"channel_mask,omitempty"` // Optional: ["telegram", "discord", "whatsapp"]
}

// NotificationConfig stores alert routing settings
type NotificationConfig struct {
	TelegramEnabled  bool   `json:"telegram_enabled"`
	TelegramBotToken string `json:"telegram_bot_token"`
	TelegramChatID   string `json:"telegram_chat_id"`

	DiscordEnabled    bool   `json:"discord_enabled"`
	DiscordWebhookURL string `json:"discord_webhook_url"`

	WhatsAppEnabled    bool   `json:"whatsapp_enabled"`
	WhatsAppWebhookURL string `json:"whatsapp_webhook_url"`
	WhatsAppPhone      string `json:"whatsapp_phone"`

	CustomWebhookEnabled bool   `json:"custom_webhook_enabled"`
	CustomWebhookURL     string `json:"custom_webhook_url"`

	// Event Subscription Toggles
	NotifyBambuFinished bool `json:"notify_bambu_finished"`
	NotifyBambuClogged  bool `json:"notify_bambu_clogged"`
	NotifyInvoicePaid   bool `json:"notify_invoice_paid"`
	NotifySSLExpiry     bool `json:"notify_ssl_expiry"`
}

// GetNotificationConfig loads settings from system_settings
func GetNotificationConfig() NotificationConfig {
	cfg := NotificationConfig{
		NotifyBambuFinished: true,
		NotifyBambuClogged:  true,
		NotifyInvoicePaid:   true,
		NotifySSLExpiry:     true,
	}

	if !database.IsConnected() {
		return cfg
	}

	var setting models.SystemSetting
	err := database.DB.Where("key = ?", "NOTIFICATION_CHANNELS").First(&setting).Error
	if err == nil && setting.JSONValue != nil {
		bytesVal, _ := json.Marshal(*setting.JSONValue)
		_ = json.Unmarshal(bytesVal, &cfg)
	}

	return cfg
}

// SaveNotificationConfig persists notification settings
func SaveNotificationConfig(cfg NotificationConfig) error {
	if !database.IsConnected() {
		return fmt.Errorf("database not connected")
	}

	var jsonMap models.JSONMap
	bytesVal, _ := json.Marshal(cfg)
	_ = json.Unmarshal(bytesVal, &jsonMap)

	setting := models.SystemSetting{
		Key:       "NOTIFICATION_CHANNELS",
		JSONValue: &jsonMap,
	}

	return database.DB.Where("key = ?", "NOTIFICATION_CHANNELS").
		Assign(setting).
		FirstOrCreate(&setting).Error
}

// DispatchAlert routes an alert event across configured external channels and internal notifications
func DispatchAlert(payload AlertPayload) {
	if payload.Timestamp.IsZero() {
		payload.Timestamp = time.Now()
	}

	// 1. Always create in-app notification for admin
	go createInAppNotification(payload)

	// 2. Load Channel Config
	cfg := GetNotificationConfig()

	// Check if this event type is enabled
	switch payload.Type {
	case AlertEventBambuFinished:
		if !cfg.NotifyBambuFinished {
			return
		}
	case AlertEventBambuClogged:
		if !cfg.NotifyBambuClogged {
			return
		}
	case AlertEventInvoicePaid:
		if !cfg.NotifyInvoicePaid {
			return
		}
	case AlertEventSSLExpiring:
		if !cfg.NotifySSLExpiry {
			return
		}
	}

	// 3. Dispatch to Discord Webhook
	if cfg.DiscordEnabled && cfg.DiscordWebhookURL != "" {
		go sendDiscordWebhook(cfg.DiscordWebhookURL, payload)
	}

	// 4. Dispatch to Telegram Bot
	if cfg.TelegramEnabled && cfg.TelegramBotToken != "" && cfg.TelegramChatID != "" {
		go sendTelegramMessage(cfg.TelegramBotToken, cfg.TelegramChatID, payload)
	}

	// 5. Dispatch to WhatsApp / Custom Webhook
	if cfg.WhatsAppEnabled && cfg.WhatsAppWebhookURL != "" {
		go sendGenericWebhook(cfg.WhatsAppWebhookURL, payload)
	}

	if cfg.CustomWebhookEnabled && cfg.CustomWebhookURL != "" {
		go sendGenericWebhook(cfg.CustomWebhookURL, payload)
	}
}

// createInAppNotification inserts into internal notifications table
func createInAppNotification(payload AlertPayload) {
	if !database.IsConnected() {
		return
	}

	notifType := "INFO"
	if payload.Severity != "" {
		notifType = payload.Severity
	}

	msg := payload.Message
	var link *string
	if payload.ActionURL != "" {
		link = &payload.ActionURL
	}

	// Find Admin user (ID 1 default)
	database.DB.Create(&models.Notification{
		UserID:  1,
		Title:   payload.Title,
		Message: &msg,
		Type:    notifType,
		Link:    link,
	})
}

// sendDiscordWebhook delivers rich embed formatting to Discord channels
func sendDiscordWebhook(webhookURL string, payload AlertPayload) {
	color := 0x3b82f6 // Blue default

	switch payload.Severity {
	case "SUCCESS":
		color = 0x10b981 // Emerald green
	case "WARNING":
		color = 0xf59e0b // Amber gold
	case "CRITICAL":
		color = 0xef4444 // Rose red
	}

	var fields []map[string]interface{}
	for k, v := range payload.Details {
		fields = append(fields, map[string]interface{}{
			"name":   strings.Title(strings.ReplaceAll(k, "_", " ")),
			"value":  fmt.Sprintf("%v", v),
			"inline": true,
		})
	}

	embed := map[string]interface{}{
		"title":       payload.Title,
		"description": payload.Message,
		"color":       color,
		"timestamp":   payload.Timestamp.Format(time.RFC3339),
		"footer": map[string]string{
			"text": "NexusCore ERP Notification Engine",
		},
	}

	if len(fields) > 0 {
		embed["fields"] = fields
	}

	if payload.ActionURL != "" {
		embed["url"] = payload.ActionURL
	}

	discordBody := map[string]interface{}{
		"username":   "NexusCore ERP",
		"avatar_url": "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/hexagon.png",
		"embeds":     []map[string]interface{}{embed},
	}

	jsonBytes, err := json.Marshal(discordBody)
	if err != nil {
		log.Printf("[Discord Webhook] Failed to marshal embed: %v", err)
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Post(webhookURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("[Discord Webhook] Request error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[Discord Webhook] Response status error: %d", resp.StatusCode)
	}
}

// sendTelegramMessage delivers HTML formatted messages via Telegram Bot API
func sendTelegramMessage(botToken, chatID string, payload AlertPayload) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("<b>%s</b>\n", payload.Title))
	sb.WriteString(fmt.Sprintf("%s\n\n", payload.Message))

	if len(payload.Details) > 0 {
		for k, v := range payload.Details {
			label := strings.Title(strings.ReplaceAll(k, "_", " "))
			sb.WriteString(fmt.Sprintf("• <b>%s:</b> <code>%v</code>\n", label, v))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(fmt.Sprintf("🕒 <i>%s</i>", payload.Timestamp.Format("02-Jan-2006 15:04:05 MST")))

	tgBody := map[string]interface{}{
		"chat_id":    chatID,
		"text":       sb.String(),
		"parse_mode": "HTML",
	}

	jsonBytes, err := json.Marshal(tgBody)
	if err != nil {
		log.Printf("[Telegram Bot] Failed to marshal message: %v", err)
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("[Telegram Bot] Request error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Telegram Bot] Response status error: %d", resp.StatusCode)
	}
}

// sendGenericWebhook posts full JSON alert payload to external endpoints
func sendGenericWebhook(targetURL string, payload AlertPayload) {
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("POST", targetURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NexusCore-ERP-Alerts/1.0")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[Generic Webhook] Failed to deliver alert to %s: %v", targetURL, err)
		return
	}
	defer resp.Body.Close()
}
