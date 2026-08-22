package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/storage"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
)

// ---- Profile Update ----

func UpdateProfile(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Email           string `json:"email"`
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !utils.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		return
	}

	updates := map[string]interface{}{}
	if req.Email != "" && req.Email != user.Email {
		updates["email"] = req.Email
	}
	if req.NewPassword != "" {
		hash, err := utils.HashPassword(req.NewPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		updates["password_hash"] = hash
	}

	if len(updates) > 0 {
		database.DB.Model(&user).Updates(updates)
	}

	ip := c.ClientIP()
	services.LogActivity(userID, "UPDATE_PROFILE", "User updated profile", nil, nil, &ip)
	c.JSON(http.StatusOK, gin.H{"message": "Profile updated"})
}

// ---- 2FA Endpoints ----

func Generate2FA(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "InvoiceCore",
		AccountName: user.Email,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate 2FA secret"})
		return
	}

	// Store secret temporarily (not enabled yet)
	secret := key.Secret()
	database.DB.Model(&user).Update("two_factor_secret", secret)

	// Generate QR code as base64 data URL
	img, err := key.Image(200, 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
		return
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encode QR code"})
		return
	}

	qrCode := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	c.JSON(http.StatusOK, gin.H{"qrCode": qrCode})
}

func Enable2FA(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if user.TwoFactorSecret == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Generate 2FA first"})
		return
	}

	if !totp.Validate(req.Token, *user.TwoFactorSecret) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code"})
		return
	}

	database.DB.Model(&user).Update("two_factor_enabled", true)

	ip := c.ClientIP()
	services.LogActivity(userID, "ENABLE_2FA", "User enabled 2FA", nil, nil, &ip)
	c.JSON(http.StatusOK, gin.H{"message": "2FA enabled successfully"})
}

func Disable2FA(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	database.DB.Model(&user).Updates(map[string]interface{}{
		"two_factor_enabled": false,
		"two_factor_secret":  nil,
	})

	ip := c.ClientIP()
	services.LogActivity(userID, "DISABLE_2FA", "User disabled 2FA", nil, nil, &ip)
	c.JSON(http.StatusOK, gin.H{"message": "2FA disabled"})
}

// ---- Notifications ----

func MarkAllNotificationsRead(c *gin.Context) {
	userID, _ := getContextUserID(c)
	database.DB.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Update("is_read", true)
	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// ---- Invoice Payment ----

func RecordInvoicePayment(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice
	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	var req struct {
		AmountReceived float64 `json:"amount_received"`
		PaymentDate    string  `json:"payment_date"`
		Notes          *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	paymentDate := time.Now()
	if req.PaymentDate != "" {
		if t, err := time.Parse(time.RFC3339, req.PaymentDate); err == nil {
			paymentDate = t
		}
	}

	database.DB.Model(&invoice).Updates(map[string]interface{}{
		"status":          "PAID",
		"payment_date":    paymentDate,
		"received_amount": req.AmountReceived,
	})

	if userID, ok := getContextUserID(c); ok {
		entityType := "INVOICE"
		entityID := strconv.Itoa(invoice.ID)
		ip := c.ClientIP()
		services.LogActivity(userID, "RECORD_PAYMENT",
			"Recorded payment for Invoice #"+invoice.InvoiceNumber, &entityType, &entityID, &ip)
	}

	database.DB.Preload("Client").First(&invoice, id)
	c.JSON(http.StatusOK, invoice)
}

// ---- Sequence Management ----

func UpdateSequence(c *gin.Context) {
	var req struct {
		Type       string `json:"type" binding:"required"`
		NextNumber string `json:"next_number" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	nextNum, err := strconv.Atoi(req.NextNumber)
	if err != nil || nextNum < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid number"})
		return
	}

	// Get current fiscal year (April-March for India)
	now := time.Now()
	fy := now.Year()
	if now.Month() < 4 {
		fy--
	}
	fiscalYear := fmt.Sprintf("%d-%d", fy, fy+1)

	switch req.Type {
	case "INVOICE":
		var seq models.InvoiceSequence
		database.DB.Where("fiscal_year = ?", fiscalYear).FirstOrCreate(&seq, models.InvoiceSequence{FiscalYear: fiscalYear})
		database.DB.Model(&seq).Update("last_count", nextNum-1)
	case "QUOTATION":
		var seq models.QuotationSequence
		database.DB.Where("fiscal_year = ?", fiscalYear).FirstOrCreate(&seq, models.QuotationSequence{FiscalYear: fiscalYear})
		database.DB.Model(&seq).Update("last_count", nextNum-1)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type must be INVOICE or QUOTATION"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Next %s number set to %d", req.Type, nextNum)})
}

// ---- File Upload ----

func UploadFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)

	// Use MinIO if connected, otherwise fall back to local filesystem
	if storage.IsConnected() {
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
			return
		}
		defer src.Close()

		key := "files/" + filename
		if err := storage.PutObject(storage.BucketUploads, key, src, file.Size, file.Header.Get("Content-Type")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload to storage"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"filePath": storage.GetPublicURL(storage.BucketUploads, key)})
		return
	}

	// Fallback: local filesystem
	uploadDir := filepath.Join("..", "frontend", "public", "uploads")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	dst := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"filePath": "/uploads/" + filename})
}

// ---- Mail Config & Templates ----

func GetMailConfig(c *gin.Context) {
	var settings []models.SystemSetting
	database.DB.Where("key = ?", "SMTP_CONFIG").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].JSONValue == nil {
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	c.JSON(http.StatusOK, settings[0].JSONValue)
}

func SaveMailConfig(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	jm := models.JSONMap(body)
	setting := models.SystemSetting{Key: "SMTP_CONFIG"}
	database.DB.Where("key = ?", "SMTP_CONFIG").
		Assign(models.SystemSetting{JSONValue: &jm}).
		FirstOrCreate(&setting)
	database.DB.Model(&setting).Update("json_value", &jm)

	c.JSON(http.StatusOK, gin.H{"message": "SMTP config saved"})
}

func GetMailTemplates(c *gin.Context) {
	var settings []models.SystemSetting
	database.DB.Where("key = ?", "EMAIL_TEMPLATES").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].JSONValue == nil {
		c.JSON(http.StatusOK, gin.H{
			"invoice":   gin.H{"subject": "", "body": ""},
			"quotation": gin.H{"subject": "", "body": ""},
		})
		return
	}
	c.JSON(http.StatusOK, settings[0].JSONValue)
}

func SaveMailTemplates(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	jm := models.JSONMap(body)
	setting := models.SystemSetting{Key: "EMAIL_TEMPLATES"}
	database.DB.Where("key = ?", "EMAIL_TEMPLATES").
		Assign(models.SystemSetting{JSONValue: &jm}).
		FirstOrCreate(&setting)
	database.DB.Model(&setting).Update("json_value", &jm)

	c.JSON(http.StatusOK, gin.H{"message": "Templates saved"})
}

func SendTestEmail(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings []models.SystemSetting
	database.DB.Where("key = ?", "SMTP_CONFIG").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].JSONValue == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP not configured"})
		return
	}

	config, err := services.GetSMTPConfig(&settings[0])
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := services.SendEmail(*config, req.Email, "InvoiceCore - Test Email",
		"<h2>Test Email</h2><p>If you're reading this, your SMTP configuration is working correctly!</p>"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Test email sent"})
}

func SendInvoiceEmail(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice
	if err := database.DB.Preload("Client").Preload("BankAccount").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	email := c.PostForm("email")
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PDF file is required"})
		return
	}

	// Get SMTP config
	var settings []models.SystemSetting
	database.DB.Where("key = ?", "SMTP_CONFIG").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].JSONValue == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP not configured"})
		return
	}

	config, err := services.GetSMTPConfig(&settings[0])
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tempPath := "./" + file.Filename
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save temp file"})
		return
	}
	defer os.Remove(tempPath)

	subject := fmt.Sprintf("Invoice %s", invoice.InvoiceNumber)
	body := fmt.Sprintf("<h2>Invoice %s</h2><p>Please find your invoice attached. Total: %.2f %s</p>",
		invoice.InvoiceNumber, invoice.GrandTotal, invoice.Currency)

	if err := services.SendEmail(*config, email, subject, body, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send: " + err.Error()})
		return
	}

	// Update invoice status to SENT if currently DRAFT
	if invoice.Status == "DRAFT" {
		database.DB.Model(&invoice).Update("status", "SENT")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invoice sent"})
}

func SendQuotationEmail(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation
	if err := database.DB.Preload("Client").Preload("BankAccount").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	email := c.PostForm("email")
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PDF file is required"})
		return
	}

	var settings []models.SystemSetting
	database.DB.Where("key = ?", "SMTP_CONFIG").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].JSONValue == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP not configured"})
		return
	}

	config, err := services.GetSMTPConfig(&settings[0])
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tempPath := "./" + file.Filename
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save temp file"})
		return
	}
	defer os.Remove(tempPath)

	subject := fmt.Sprintf("Quotation %s", quotation.QuotationNumber)
	body := fmt.Sprintf("<h2>Quotation %s</h2><p>Please find your quotation attached. Total: %.2f %s</p>",
		quotation.QuotationNumber, quotation.GrandTotal, quotation.Currency)

	if err := services.SendEmail(*config, email, subject, body, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send: " + err.Error()})
		return
	}

	if quotation.Status == "DRAFT" {
		database.DB.Model(&quotation).Update("status", "SENT")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Quotation sent"})
}

// ---- Backup Export/Import ----

func ExportBackup(c *gin.Context) {
	backup := map[string]interface{}{}

	var settings []models.SystemSetting
	database.DB.Find(&settings)
	backup["settings"] = settings

	var users []models.User
	database.DB.Find(&users)
	backup["users"] = users

	var clients []models.Client
	database.DB.Find(&clients)
	backup["clients"] = clients

	var invoices []models.Invoice
	database.DB.Find(&invoices)
	backup["invoices"] = invoices

	var quotations []models.Quotation
	database.DB.Find(&quotations)
	backup["quotations"] = quotations

	var expenses []models.Expense
	database.DB.Find(&expenses)
	backup["expenses"] = expenses

	var otherIncome []models.OtherIncome
	database.DB.Find(&otherIncome)
	backup["other_income"] = otherIncome

	var banks []models.BankAccount
	database.DB.Find(&banks)
	backup["bank_accounts"] = banks

	var invoiceSeqs []models.InvoiceSequence
	database.DB.Find(&invoiceSeqs)
	backup["invoice_sequences"] = invoiceSeqs

	var quotationSeqs []models.QuotationSequence
	database.DB.Find(&quotationSeqs)
	backup["quotation_sequences"] = quotationSeqs

	backup["exported_at"] = time.Now().Format(time.RFC3339)
	backup["version"] = "2.0.0"

	data, err := json.Marshal(backup)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export"})
		return
	}

	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=backup-%s.iec", time.Now().Format("2006-01-02")))
	c.Data(http.StatusOK, "application/octet-stream", data)
}

func ImportBackup(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	var backup map[string]json.RawMessage
	if err := json.Unmarshal(data, &backup); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup file"})
		return
	}

	// Verify it has the version key
	if _, ok := backup["version"]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup file format"})
		return
	}

	// Import settings
	if raw, ok := backup["settings"]; ok {
		var settings []models.SystemSetting
		if json.Unmarshal(raw, &settings) == nil {
			for _, s := range settings {
				database.DB.Where("key = ?", s.Key).
					Assign(models.SystemSetting{Value: s.Value, JSONValue: s.JSONValue}).
					FirstOrCreate(&s)
			}
		}
	}

	// Import clients
	if raw, ok := backup["clients"]; ok {
		var clients []models.Client
		if json.Unmarshal(raw, &clients) == nil {
			for _, cl := range clients {
				database.DB.Where("id = ?", cl.ID).FirstOrCreate(&cl)
			}
		}
	}

	// Import bank accounts
	if raw, ok := backup["bank_accounts"]; ok {
		var banks []models.BankAccount
		if json.Unmarshal(raw, &banks) == nil {
			for _, b := range banks {
				database.DB.Where("id = ?", b.ID).FirstOrCreate(&b)
			}
		}
	}

	// Import invoices
	if raw, ok := backup["invoices"]; ok {
		var invoices []models.Invoice
		if json.Unmarshal(raw, &invoices) == nil {
			for _, inv := range invoices {
				database.DB.Where("id = ?", inv.ID).FirstOrCreate(&inv)
			}
		}
	}

	// Import quotations
	if raw, ok := backup["quotations"]; ok {
		var quotations []models.Quotation
		if json.Unmarshal(raw, &quotations) == nil {
			for _, q := range quotations {
				database.DB.Where("id = ?", q.ID).FirstOrCreate(&q)
			}
		}
	}

	// Import expenses
	if raw, ok := backup["expenses"]; ok {
		var expenses []models.Expense
		if json.Unmarshal(raw, &expenses) == nil {
			for _, e := range expenses {
				database.DB.Where("id = ?", e.ID).FirstOrCreate(&e)
			}
		}
	}

	// Import other income
	if raw, ok := backup["other_income"]; ok {
		var incomes []models.OtherIncome
		if json.Unmarshal(raw, &incomes) == nil {
			for _, i := range incomes {
				database.DB.Where("id = ?", i.ID).FirstOrCreate(&i)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup restored successfully"})
}
