package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
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

type WCOrder struct {
	ID                 int     `json:"id"`
	Number             string  `json:"number"`
	Status             string  `json:"status"` // pending, processing, on-hold, completed, cancelled, refunded
	Currency           string  `json:"currency"`
	Total              string  `json:"total"`
	TotalTax           string  `json:"total_tax"`
	ShippingTotal      string  `json:"shipping_total"`
	PaymentMethodTitle string  `json:"payment_method_title"`
	DateCreated        string  `json:"date_created"`
	Billing struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Company   string `json:"company"`
		Address1  string `json:"address_1"`
		City      string `json:"city"`
		State     string `json:"state"`
		Postcode  string `json:"postcode"`
		Country   string `json:"country"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
	} `json:"billing"`
	Shipping struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Address1  string `json:"address_1"`
		City      string `json:"city"`
		State     string `json:"state"`
		Postcode  string `json:"postcode"`
		Country   string `json:"country"`
	} `json:"shipping"`
	LineItems []struct {
		ID        int     `json:"id"`
		Name      string  `json:"name"`
		ProductID int     `json:"product_id"`
		Quantity  int     `json:"quantity"`
		Subtotal  string  `json:"subtotal"`
		Total     string  `json:"total"`
		SKU       string  `json:"sku"`
		Price     float64 `json:"price"`
	} `json:"line_items"`
}

func verifyWCSignature(payload []byte, signature, secret string) bool {
	if secret == "" {
		return true // Allow sandbox testing if webhook secret not yet configured
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedMAC := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expectedMAC), []byte(signature))
}

// WooCommerceWebhookHandler ingests real-time sales from TYTGEAR WooCommerce store
func WooCommerceWebhookHandler(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	secret := getWebhookSecret("WOOCOMMERCE_WEBHOOK_SECRET")
	signature := c.GetHeader("X-WC-Webhook-Signature")
	topic := c.GetHeader("X-WC-Webhook-Topic")

	if secret != "" && !verifyWCSignature(body, signature, secret) {
		log.Printf("❌ Invalid WooCommerce Webhook Signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	log.Printf("🛒 Received WooCommerce Webhook Event: %s", topic)

	var order WCOrder
	if err := json.Unmarshal(body, &order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format: " + err.Error()})
		return
	}

	inv, err := processWooCommerceOrder(&order)
	if err != nil {
		log.Printf("❌ Error processing WooCommerce order #%d: %v", order.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"message":        fmt.Sprintf("Processed WooCommerce order #%s", order.Number),
		"invoice_number": inv.InvoiceNumber,
	})
}

func processWooCommerceOrder(order *WCOrder) (*models.Invoice, error) {
	tytBU := "tytgear"

	// 1. Find or create Client
	clientName := strings.TrimSpace(order.Billing.FirstName + " " + order.Billing.LastName)
	if clientName == "" {
		if order.Billing.Company != "" {
			clientName = order.Billing.Company
		} else {
			clientName = "TYTGEAR Customer #" + strconv.Itoa(order.ID)
		}
	}

	email := order.Billing.Email
	phone := order.Billing.Phone
	country := order.Billing.Country
	if country == "" {
		country = "India"
	}
	state := order.Billing.State

	var client models.Client
	query := database.DB.Where("business_unit_id = ?", tytBU)
	if email != "" {
		query = query.Where("email = ?", email)
	} else {
		query = query.Where("company_name = ?", clientName)
	}

	if err := query.First(&client).Error; err != nil {
		// Create new client
		client = models.Client{
			CompanyName:    clientName,
			Email:          &email,
			Phone:          &phone,
			Country:        country,
			State:          &state,
			BusinessUnitID: &tytBU,
			Addresses: &models.JSONMap{
				"billing": map[string]interface{}{
					"address":  order.Billing.Address1,
					"city":     order.Billing.City,
					"state":    order.Billing.State,
					"postcode": order.Billing.Postcode,
					"country":  order.Billing.Country,
				},
				"shipping": map[string]interface{}{
					"address":  order.Shipping.Address1,
					"city":     order.Shipping.City,
					"state":    order.Shipping.State,
					"postcode": order.Shipping.Postcode,
					"country":  order.Shipping.Country,
				},
			},
		}
		database.DB.Create(&client)
	}

	// 2. Prepare Line Items & Total Calculations
	var lineItems models.JSONArray
	var computedSubtotal float64
	has3DPrintItem := false

	for _, item := range order.LineItems {
		itemTotal, _ := strconv.ParseFloat(item.Total, 64)
		itemSubtotal, _ := strconv.ParseFloat(item.Subtotal, 64)
		computedSubtotal += itemSubtotal

		lineItems = append(lineItems, map[string]interface{}{
			"description": fmt.Sprintf("%s (SKU: %s)", item.Name, item.SKU),
			"quantity":    float64(item.Quantity),
			"rate":        item.Price,
			"amount":      itemTotal,
		})

		lowerName := strings.ToLower(item.Name)
		if strings.Contains(lowerName, "3d") || strings.Contains(lowerName, "print") || strings.Contains(lowerName, "keycap") || strings.Contains(lowerName, "custom") {
			has3DPrintItem = true
		}
	}

	grandTotal, _ := strconv.ParseFloat(order.Total, 64)
	if computedSubtotal <= 0 {
		computedSubtotal = grandTotal
	}

	invoiceNum := fmt.Sprintf("TYT-WC-%d", order.ID)
	if order.Number != "" {
		invoiceNum = fmt.Sprintf("TYT-WC-%s", order.Number)
	}

	invStatus := "PAID"
	if order.Status == "pending" || order.Status == "on-hold" {
		invStatus = "SENT"
	} else if order.Status == "cancelled" || order.Status == "refunded" {
		invStatus = "CANCELLED"
	}

	now := time.Now()
	var paymentDate *time.Time
	if invStatus == "PAID" {
		paymentDate = &now
	}

	var invoice models.Invoice
	if err := database.DB.Where("invoice_number = ?", invoiceNum).First(&invoice).Error; err == nil {
		// Update existing invoice
		invoice.Status = invStatus
		invoice.Subtotal = computedSubtotal
		invoice.GrandTotal = grandTotal
		invoice.PaymentDate = paymentDate
		invoice.ReceivedAmount = &grandTotal
		invoice.LineItems = lineItems
		database.DB.Save(&invoice)
	} else {
		// Create new invoice
		cat := "WooCommerce Store"
		remarks := fmt.Sprintf("Synced from TYTGEAR WooCommerce Store via %s (Order #%s)", order.PaymentMethodTitle, order.Number)
		invoice = models.Invoice{
			InvoiceNumber:  invoiceNum,
			ClientID:       client.ID,
			BusinessUnitID: &tytBU,
			Status:         invStatus,
			IssueDate:      now,
			Currency:       "INR",
			BaseCurrency:   "INR",
			ExchangeRate:   1.0,
			Subtotal:       computedSubtotal,
			GrandTotal:     grandTotal,
			ReceivedAmount: &grandTotal,
			PaymentDate:    paymentDate,
			Category:       &cat,
			Remarks:        &remarks,
			LineItems:      lineItems,
			TaxSummary: models.JSONMap{
				"tax_type": "GST",
				"total":    grandTotal - computedSubtotal,
			},
		}
		database.DB.Create(&invoice)
	}

	// 3. Auto enqueue 3D print job if order contains customized 3D merchandise
	if has3DPrintItem && invStatus != "CANCELLED" {
		var existingJob models.PrintJob
		jobTitle := fmt.Sprintf("WooCommerce Order #%s Custom Print", order.Number)
		if err := database.DB.Where("title = ?", jobTitle).First(&existingJob).Error; err != nil {
			printJob := models.PrintJob{
				Title:               jobTitle,
				ClientID:            &client.ID,
				BusinessUnitID:      &tytBU,
				Status:              "Queue",
				EstimatedTimeHours:  4.0,
				FilamentWeightGrams: 120.0,
				Revenue:             grandTotal,
			}
			database.DB.Create(&printJob)
			log.Printf("🖨️ [WooCommerce Auto-Print] Enqueued 3D Print Job for Order #%s", order.Number)
		}
	}

	// 4. Log Activity and Create Notification
	desc := fmt.Sprintf("WooCommerce Order #%s (₹%.2f) synced for TYTGEAR [%s]", order.Number, grandTotal, invStatus)
	entityType := "INVOICE"
	entityID := strconv.Itoa(invoice.ID)
	services.LogActivity(1, "WOOCOMMERCE_ORDER_SYNC", desc, &entityType, &entityID, nil)

	notifTitle := fmt.Sprintf("🛒 New TYTGEAR Sale: Order #%s", order.Number)
	notifMsg := fmt.Sprintf("Received ₹%.2f from %s via %s", grandTotal, clientName, order.PaymentMethodTitle)
	database.DB.Create(&models.Notification{
		UserID:  1,
		Title:   notifTitle,
		Message: &notifMsg,
		Type:    "SUCCESS",
	})

	return &invoice, nil
}

// GetWooCommerceOrders returns recent orders ingested from WooCommerce
func GetWooCommerceOrders(c *gin.Context) {
	var invoices []models.Invoice
	database.DB.Preload("Client").
		Where("business_unit_id = ? AND (invoice_number LIKE 'TYT-WC-%' OR category = 'WooCommerce Store')", "tytgear").
		Order("created_at desc").
		Limit(50).
		Find(&invoices)

	c.JSON(http.StatusOK, gin.H{"data": invoices})
}

// SaveWooCommerceConfig saves WooCommerce store settings
func SaveWooCommerceConfig(c *gin.Context) {
	var req struct {
		StoreURL       string `json:"store_url" binding:"required"`
		ConsumerKey    string `json:"consumer_key"`
		ConsumerSecret string `json:"consumer_secret"`
		WebhookSecret  string `json:"webhook_secret"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wcMap := models.JSONMap{
		"store_url":            req.StoreURL,
		"consumer_key":         req.ConsumerKey,
		"consumer_secret":      req.ConsumerSecret,
		"webhook_secret":       req.WebhookSecret,
		"auto_create_invoices": true,
		"auto_print_queue":     true,
	}

	database.DB.Model(&models.BusinessUnit{}).
		Where("id = ?", "tytgear").
		Update("woocommerce_settings", wcMap)

	if req.WebhookSecret != "" {
		val := req.WebhookSecret
		database.DB.Where("key = ?", "WOOCOMMERCE_WEBHOOK_SECRET").
			Assign(models.SystemSetting{Value: &val}).
			FirstOrCreate(&models.SystemSetting{Key: "WOOCOMMERCE_WEBHOOK_SECRET", Value: &val})
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "WooCommerce settings saved successfully"})
}

// GetWooCommerceConfig returns current WooCommerce settings
func GetWooCommerceConfig(c *gin.Context) {
	var bu models.BusinessUnit
	if err := database.DB.Where("id = ?", "tytgear").First(&bu).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "TYTGEAR business unit not found"})
		return
	}

	settings := bu.WooCommerceSettings
	if settings == nil {
		settings = &models.JSONMap{
			"store_url": "https://tytgear.com",
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": settings})
}
