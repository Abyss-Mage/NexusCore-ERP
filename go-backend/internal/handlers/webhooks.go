package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

func verifyHMACSHA256(payload []byte, signature, secret string) bool {
	if secret == "" {
		return true // If webhook secret is not set, allow for dev/sandbox mode
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expectedMAC), []byte(signature))
}

func getWebhookSecret(key string) string {
	var setting models.SystemSetting
	if err := database.DB.Where("key = ?", key).First(&setting).Error; err == nil && setting.Value != nil {
		return *setting.Value
	}
	return ""
}

// reconcileInvoicePayment marks invoice as PAID and logs ledger entries
func reconcileInvoicePayment(invoiceRef string, amount float64, gateway, paymentID string) (*models.Invoice, error) {
	var invoice models.Invoice

	// 1. Try finding by ID
	if id, err := strconv.Atoi(invoiceRef); err == nil && id > 0 {
		if err := database.DB.Preload("Client").First(&invoice, id).Error; err == nil {
			return applyPayment(&invoice, amount, gateway, paymentID)
		}
	}

	// 2. Try finding by InvoiceNumber (e.g. "INV-2425-001")
	cleanRef := strings.TrimSpace(invoiceRef)
	if err := database.DB.Preload("Client").Where("invoice_number = ?", cleanRef).First(&invoice).Error; err == nil {
		return applyPayment(&invoice, amount, gateway, paymentID)
	}

	// 3. Try partial match without prefix
	if err := database.DB.Preload("Client").Where("invoice_number LIKE ?", "%"+cleanRef+"%").First(&invoice).Error; err == nil {
		return applyPayment(&invoice, amount, gateway, paymentID)
	}

	return nil, fmt.Errorf("invoice not found for reference: %s", invoiceRef)
}

func applyPayment(invoice *models.Invoice, amount float64, gateway, paymentID string) (*models.Invoice, error) {
	now := time.Now()
	invoice.Status = "PAID"
	invoice.PaymentDate = &now
	invoice.ReceivedAmount = &amount

	if err := database.DB.Save(invoice).Error; err != nil {
		return nil, err
	}

	// Record Activity Log
	desc := fmt.Sprintf("Payment of %.2f %s reconciled via %s (Txn ID: %s)", amount, invoice.Currency, gateway, paymentID)
	entityType := "INVOICE"
	entityID := strconv.Itoa(invoice.ID)
	services.LogActivity(1, "PAYMENT_RECONCILED", desc, &entityType, &entityID, nil)

	// Post to double-entry ledger
	_ = services.PostInvoicePaymentJournalEntry(invoice)

	// Dispatch Push / Webhook Alert
	clientName := "Valued Client"
	if invoice.Client.CompanyName != "" {
		clientName = invoice.Client.CompanyName
	}

	services.DispatchAlert(services.AlertPayload{
		Type:      services.AlertEventInvoicePaid,
		Title:     fmt.Sprintf("💰 Invoice Paid via %s: #%s", gateway, invoice.InvoiceNumber),
		Message:   fmt.Sprintf("%s has settled Invoice #%s for %s %.2f via %s!", clientName, invoice.InvoiceNumber, invoice.Currency, amount, gateway),
		Severity:  "SUCCESS",
		Timestamp: now,
		Details: map[string]interface{}{
			"invoice_number": invoice.InvoiceNumber,
			"client_name":    clientName,
			"amount":         fmt.Sprintf("%s %.2f", invoice.Currency, amount),
			"gateway":        gateway,
			"transaction_id": paymentID,
			"status":         "PAID",
		},
	})

	log.Printf("💳 [Payment Reconciliation] Invoice %s marked as PAID via %s", invoice.InvoiceNumber, gateway)
	return invoice, nil
}

// RazorpayWebhookHandler handles webhooks from Razorpay
func RazorpayWebhookHandler(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	secret := getWebhookSecret("RAZORPAY_WEBHOOK_SECRET")
	signature := c.GetHeader("X-Razorpay-Signature")

	if secret != "" && !verifyHMACSHA256(body, signature, secret) {
		log.Printf("❌ Invalid Razorpay Webhook signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	var payload struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID          string                 `json:"id"`
					Amount      int                    `json:"amount"` // in paise
					Currency    string                 `json:"currency"`
					Status      string                 `json:"status"`
					Description string                 `json:"description"`
					Notes       map[string]interface{} `json:"notes"`
				} `json:"entity"`
			} `json:"payment"`
			Order struct {
				Entity struct {
					ID     string                 `json:"id"`
					Notes  map[string]interface{} `json:"notes"`
					Amount int                    `json:"amount"`
				} `json:"entity"`
			} `json:"order"`
		} `json:"payload"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
		return
	}

	log.Printf("🔔 Received Razorpay Webhook Event: %s", payload.Event)

	if payload.Event == "payment.captured" || payload.Event == "order.paid" {
		payment := payload.Payload.Payment.Entity
		amount := float64(payment.Amount) / 100.0 // Convert paise to INR

		var invoiceRef string
		if val, ok := payment.Notes["invoice_number"].(string); ok && val != "" {
			invoiceRef = val
		} else if val, ok := payment.Notes["invoice_id"].(string); ok && val != "" {
			invoiceRef = val
		} else if val, ok := payload.Payload.Order.Entity.Notes["invoice_number"].(string); ok && val != "" {
			invoiceRef = val
		} else if strings.Contains(payment.Description, "INV-") {
			invoiceRef = payment.Description
		}

		if invoiceRef != "" {
			if inv, err := reconcileInvoicePayment(invoiceRef, amount, "Razorpay", payment.ID); err == nil {
				c.JSON(http.StatusOK, gin.H{
					"status":  "success",
					"message": fmt.Sprintf("Reconciled invoice %s", inv.InvoiceNumber),
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "received"})
}

// StripeWebhookHandler handles webhooks from Stripe
func StripeWebhookHandler(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	var event struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID            string                 `json:"id"`
				Amount        int                    `json:"amount"` // in cents
				AmountTotal   int                    `json:"amount_total"`
				Currency      string                 `json:"currency"`
				Status        string                 `json:"status"`
				ClientRefID   string                 `json:"client_reference_id"`
				Metadata      map[string]interface{} `json:"metadata"`
				PaymentIntent string                 `json:"payment_intent"`
			} `json:"object"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format"})
		return
	}

	log.Printf("🔔 Received Stripe Webhook Event: %s", event.Type)

	if event.Type == "checkout.session.completed" || event.Type == "payment_intent.succeeded" || event.Type == "charge.succeeded" {
		obj := event.Data.Object
		amountVal := obj.Amount
		if amountVal <= 0 {
			amountVal = obj.AmountTotal
		}
		amount := float64(amountVal) / 100.0

		var invoiceRef string
		if val, ok := obj.Metadata["invoice_number"].(string); ok && val != "" {
			invoiceRef = val
		} else if val, ok := obj.Metadata["invoice_id"].(string); ok && val != "" {
			invoiceRef = val
		} else if obj.ClientRefID != "" {
			invoiceRef = obj.ClientRefID
		}

		if invoiceRef != "" {
			if inv, err := reconcileInvoicePayment(invoiceRef, amount, "Stripe", obj.ID); err == nil {
				c.JSON(http.StatusOK, gin.H{
					"status":  "success",
					"message": fmt.Sprintf("Reconciled invoice %s", inv.InvoiceNumber),
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "received"})
}

// PayPalWebhookHandler handles webhooks from PayPal
func PayPalWebhookHandler(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	var event struct {
		EventType string `json:"event_type"`
		Resource  struct {
			ID       string `json:"id"`
			CustomID string `json:"custom_id"`
			InvoiceID string `json:"invoice_id"`
			Amount   struct {
				Value    string `json:"value"`
				Currency string `json:"currency_code"`
			} `json:"amount"`
		} `json:"resource"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	log.Printf("🔔 Received PayPal Webhook Event: %s", event.EventType)

	if event.EventType == "PAYMENT.CAPTURE.COMPLETED" || event.EventType == "INVOICING.INVOICE.PAID" {
		amount, _ := strconv.ParseFloat(event.Resource.Amount.Value, 64)
		ref := event.Resource.CustomID
		if ref == "" {
			ref = event.Resource.InvoiceID
		}

		if ref != "" {
			if inv, err := reconcileInvoicePayment(ref, amount, "PayPal", event.Resource.ID); err == nil {
				c.JSON(http.StatusOK, gin.H{
					"status":  "success",
					"message": fmt.Sprintf("Reconciled invoice %s", inv.InvoiceNumber),
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "received"})
}
