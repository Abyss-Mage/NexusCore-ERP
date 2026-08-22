package handlers

import (
	"fmt"
	"html/template"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

// templateMeta is the metadata returned to the frontend (never raw HTML).
type templateMeta struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	IsBuiltin bool   `json:"is_builtin"`
	IsActive  bool   `json:"is_active"`
}

// customTemplateDBKey returns the system_settings key for a custom template.
func customTemplateDBKey(tplType, name string) string {
	return fmt.Sprintf("CUSTOM_TPL_%s_%s", strings.ToUpper(tplType), strings.ToUpper(name))
}

// activeTemplateDBKey returns the system_settings key for the active template selection.
func activeTemplateDBKey(tplType string) string {
	return fmt.Sprintf("ACTIVE_%s_TEMPLATE", strings.ToUpper(tplType))
}

// getActiveTemplateName returns the currently active template name for a type, defaulting to "professional".
func getActiveTemplateName(tplType string) string {
	key := activeTemplateDBKey(tplType)
	var settings []models.SystemSetting
	database.DB.Where("key = ?", key).Limit(1).Find(&settings)
	if len(settings) > 0 && settings[0].Value != nil && *settings[0].Value != "" {
		return *settings[0].Value
	}
	return "professional"
}

// ListTemplates returns metadata for all available templates (built-in + custom).
// GET /api/templates/list
func ListTemplates(c *gin.Context) {
	activeName := map[string]string{
		"invoice":   getActiveTemplateName("invoice"),
		"quotation": getActiveTemplateName("quotation"),
	}

	var result []templateMeta

	// Built-in templates
	for _, bt := range builtinTemplates() {
		result = append(result, templateMeta{
			Name:      bt.Name,
			Type:      bt.Type,
			IsBuiltin: true,
			IsActive:  activeName[bt.Type] == bt.Name,
		})
	}

	// Custom templates from DB
	var customSettings []models.SystemSetting
	database.DB.Where("key LIKE ?", "CUSTOM_TPL_%").Find(&customSettings)
	for _, s := range customSettings {
		// Parse key: CUSTOM_TPL_{TYPE}_{NAME}
		parts := strings.SplitN(s.Key, "_", 4) // CUSTOM, TPL, TYPE, NAME
		if len(parts) < 4 {
			continue
		}
		tplType := strings.ToLower(parts[2])
		name := strings.ToLower(parts[3])
		result = append(result, templateMeta{
			Name:      name,
			Type:      tplType,
			IsBuiltin: false,
			IsActive:  activeName[tplType] == name,
		})
	}

	c.JSON(http.StatusOK, result)
}

// UploadTemplate accepts an HTML file or .ict file and stores the template.
// POST /api/templates/upload
func UploadTemplate(c *gin.Context) {
	tplType := c.PostForm("type")
	if tplType != "invoice" && tplType != "quotation" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'invoice' or 'quotation'"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	var htmlContent string
	var templateName string

	filename := header.Filename

	if strings.HasSuffix(strings.ToLower(filename), ".ict") {
		// Import encrypted .ict file
		html, ictType, err := services.DecryptTemplate(fileBytes)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid .ict file: " + err.Error()})
			return
		}
		// Verify type matches
		if services.ICTTypeString(ictType) != tplType {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("template type mismatch: file is %s but you selected %s", services.ICTTypeString(ictType), tplType)})
			return
		}
		htmlContent = string(html)
		templateName = strings.TrimSuffix(filename, ".ict")
	} else if strings.HasSuffix(strings.ToLower(filename), ".html") || strings.HasSuffix(strings.ToLower(filename), ".htm") {
		// Raw HTML upload — sanitize
		htmlContent = sanitizeTemplate(string(fileBytes))
		templateName = strings.TrimSuffix(strings.TrimSuffix(filename, ".html"), ".htm")
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file must be .html or .ict"})
		return
	}

	// Sanitize template name
	templateName = sanitizeName(templateName)
	if templateName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template name"})
		return
	}

	// Check name doesn't conflict with built-in
	for _, bt := range builtinTemplates() {
		if bt.Name == templateName && bt.Type == tplType {
			c.JSON(http.StatusConflict, gin.H{"error": "name conflicts with a built-in template"})
			return
		}
	}

	// Validate Go template syntax
	funcMap := template.FuncMap{
		"inc":      func(i int) int { return i + 1 },
		"fmtFloat": func(f interface{}) string { return fmt.Sprintf("%v", f) },
		"derefStr": func(s *string) string { return "" },
	}
	if _, err := template.New("test").Funcs(funcMap).Parse(htmlContent); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template syntax: " + err.Error()})
		return
	}

	// Store in system_settings
	dbKey := customTemplateDBKey(tplType, templateName)
	setting := models.SystemSetting{Key: dbKey}
	database.DB.Where("key = ?", dbKey).
		Assign(models.SystemSetting{Value: &htmlContent}).
		FirstOrCreate(&setting)
	database.DB.Model(&setting).Update("value", htmlContent)

	c.JSON(http.StatusOK, gin.H{
		"message": "Template uploaded successfully",
		"name":    templateName,
		"type":    tplType,
	})
}

// ExportTemplate exports a custom template as an encrypted .ict file.
// GET /api/templates/:name/export?type=invoice|quotation
func ExportTemplate(c *gin.Context) {
	name := c.Param("name")
	tplType := c.Query("type")
	if tplType != "invoice" && tplType != "quotation" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type query param required (invoice or quotation)"})
		return
	}

	// Get template content (built-in or custom)
	html, found := resolveTemplate(name, tplType)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}

	ictTypeByte, _ := services.ICTTypeFromString(tplType)
	ictBytes, err := services.EncryptTemplate([]byte(html), ictTypeByte)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption failed"})
		return
	}

	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", services.WriteICTContentDisposition(name))
	c.Data(http.StatusOK, "application/octet-stream", ictBytes)
}

// DeleteTemplate removes a custom template.
// DELETE /api/templates/:name?type=invoice|quotation
func DeleteTemplate(c *gin.Context) {
	name := c.Param("name")
	tplType := c.Query("type")
	if tplType != "invoice" && tplType != "quotation" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type query param required"})
		return
	}

	// Can't delete built-in
	for _, bt := range builtinTemplates() {
		if bt.Name == name && bt.Type == tplType {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete built-in templates"})
			return
		}
	}

	dbKey := customTemplateDBKey(tplType, name)
	result := database.DB.Where("key = ?", dbKey).Delete(&models.SystemSetting{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}

	// If this was the active template, revert to professional
	if getActiveTemplateName(tplType) == name {
		activeKey := activeTemplateDBKey(tplType)
		val := "professional"
		database.DB.Where("key = ?", activeKey).
			Assign(models.SystemSetting{Value: &val}).
			FirstOrCreate(&models.SystemSetting{Key: activeKey})
		database.DB.Model(&models.SystemSetting{Key: activeKey}).Update("value", val)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Template deleted"})
}

// SetActiveTemplate sets the active template for a type.
// PUT /api/templates/active
func SetActiveTemplate(c *gin.Context) {
	var req struct {
		Type string `json:"type" binding:"required"`
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type != "invoice" && req.Type != "quotation" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'invoice' or 'quotation'"})
		return
	}

	// Verify template exists
	if _, found := resolveTemplate(req.Name, req.Type); !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}

	activeKey := activeTemplateDBKey(req.Type)
	setting := models.SystemSetting{Key: activeKey}
	database.DB.Where("key = ?", activeKey).
		Assign(models.SystemSetting{Value: &req.Name}).
		FirstOrCreate(&setting)
	database.DB.Model(&setting).Update("value", req.Name)

	c.JSON(http.StatusOK, gin.H{"message": "Active template updated", "name": req.Name, "type": req.Type})
}

// PreviewTemplate generates a sample PDF using the specified template.
// GET /api/templates/:name/preview?type=invoice|quotation
func PreviewTemplate(c *gin.Context) {
	name := c.Param("name")
	tplType := c.Query("type")
	if tplType != "invoice" && tplType != "quotation" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type query param required"})
		return
	}

	tmplContent, found := resolveTemplate(name, tplType)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}

	// Load company settings for branding
	var companySetting []models.SystemSetting
	database.DB.Where("key = ?", "company").Limit(1).Find(&companySetting)
	var company map[string]interface{}
	if len(companySetting) > 0 && companySetting[0].JSONValue != nil {
		company = map[string]interface{}(*companySetting[0].JSONValue)
	}
	branding := services.LoadBrandingAssets(company)

	var data map[string]interface{}
	if tplType == "invoice" {
		data = sampleInvoiceData(company, branding)
	} else {
		data = sampleQuotationData(company, branding)
	}

	htmlContent, err := services.RenderTemplate(tmplContent, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "template render failed: " + err.Error()})
		return
	}

	// Because we migrated away from backend PDF generation, we return the raw HTML
	// for the preview. The browser will render it in a new tab.
	c.Header("Content-Type", "text/html")
	c.Data(http.StatusOK, "text/html", []byte(htmlContent))
}

// resolveTemplate returns the template HTML for a given name and type.
func resolveTemplate(name, tplType string) (string, bool) {
	// Check built-in first
	if content, ok := getBuiltinTemplate(name, tplType); ok {
		return content, true
	}
	// Check custom in DB
	dbKey := customTemplateDBKey(tplType, name)
	var settings []models.SystemSetting
	database.DB.Where("key = ?", dbKey).Limit(1).Find(&settings)
	if len(settings) > 0 && settings[0].Value != nil && *settings[0].Value != "" {
		return *settings[0].Value, true
	}
	return "", false
}

// ResolveActiveTemplate returns the template content for the currently active template.
// Used by generateInvoicePDF / generateQuotationPDF.
func ResolveActiveTemplate(tplType string) string {
	name := getActiveTemplateName(tplType)
	content, found := resolveTemplate(name, tplType)
	if !found {
		// Fallback to professional
		content, _ = getBuiltinTemplate("professional", tplType)
	}
	return content
}

// --- Helpers ---

var nameRegexp = regexp.MustCompile(`[^a-z0-9_-]`)

func sanitizeName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	s = nameRegexp.ReplaceAllString(s, "")
	if len(s) > 50 {
		s = s[:50]
	}
	return s
}

func sanitizeTemplate(html string) string {
	// Strip <script> tags
	scriptRe := regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	html = scriptRe.ReplaceAllString(html, "")
	// Strip on* event handlers
	eventRe := regexp.MustCompile(`(?i)\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)`)
	html = eventRe.ReplaceAllString(html, "")
	return html
}

// sampleInvoiceData returns dummy data for template preview.
func sampleInvoiceData(company map[string]interface{}, branding map[string]string) map[string]interface{} {
	type sampleClient struct {
		CompanyName   string
		ContactPerson *string
		Email         *string
		Phone         *string
		TaxID         *string
	}
	type sampleBank struct {
		BankName      string
		AccountNumber string
		IFSCCode      *string
		SwiftCode     *string
		UPIID         *string
	}
	type sampleInvoice struct {
		InvoiceNumber string
		Status        string
		Currency      string
		IssueDate     sampleTime
		DueDate       *sampleTime
		Client        sampleClient
		BankAccount   *sampleBank
		LineItems     []map[string]interface{}
		Subtotal      float64
		GrandTotal    float64
		Remarks       *string
	}

	contact := "John Doe"
	email := "john@acme.com"
	phone := "+91 98765 43210"
	taxID := "29ABCDE1234F1Z5"
	ifsc := "SBIN0001234"
	upi := "company@upi"
	remarks := "Payment due within 30 days. Thank you for your business."
	due := sampleTime{year: 2026, month: 3, day: 15}

	inv := sampleInvoice{
		InvoiceNumber: "INV/2526/001",
		Status:        "SENT",
		Currency:      "INR",
		IssueDate:     sampleTime{year: 2026, month: 2, day: 15},
		DueDate:       &due,
		Client: sampleClient{
			CompanyName:   "Acme Corporation Pvt. Ltd.",
			ContactPerson: &contact,
			Email:         &email,
			Phone:         &phone,
			TaxID:         &taxID,
		},
		BankAccount: &sampleBank{
			BankName:      "State Bank of India",
			AccountNumber: "1234567890123",
			IFSCCode:      &ifsc,
			UPIID:         &upi,
		},
		LineItems: []map[string]interface{}{
			{"description": "Website Design & Development", "hsn": "998314", "qty": float64(1), "rate": float64(45000), "amount": float64(45000)},
			{"description": "SEO Optimization Package", "hsn": "998366", "qty": float64(1), "rate": float64(15000), "amount": float64(15000)},
			{"description": "Monthly Maintenance (3 months)", "hsn": "998314", "qty": float64(3), "rate": float64(5000), "amount": float64(15000)},
		},
		Subtotal:   75000,
		GrandTotal: 88500,
		Remarks:    &remarks,
	}

	type taxRow struct {
		Label  string
		Amount string
	}

	return map[string]interface{}{
		"Invoice":       &inv,
		"Company":       company,
		"DocConfig":     nil,
		"Logo":          template.URL(branding["logo"]),
		"Signature":     template.URL(branding["signature"]),
		"Stamp":         template.URL(branding["stamp"]),
		"TaxRows":       []taxRow{{Label: "CGST (9%)", Amount: "6750.00"}, {Label: "SGST (9%)", Amount: "6750.00"}},
		"ClientAddress": "123 Business Park, Bangalore, Karnataka, 560001",
	}
}

func sampleQuotationData(company map[string]interface{}, branding map[string]string) map[string]interface{} {
	type sampleClient struct {
		CompanyName   string
		ContactPerson *string
		Email         *string
		Phone         *string
	}
	type sampleQuotation struct {
		QuotationNumber string
		Status          string
		Currency        string
		IssueDate       sampleTime
		ExpiryDate      *sampleTime
		Client          sampleClient
		LineItems       []map[string]interface{}
		Subtotal        float64
		GrandTotal      float64
		ServicesOffered *string
		ContractTerms   *string
		Remarks         *string
	}

	contact := "Jane Smith"
	email := "jane@startup.io"
	phone := "+91 87654 32109"
	svcs := "Full-stack web application development, UI/UX design, cloud deployment, and 6 months post-launch support."
	terms := "50% advance payment required. Remaining 50% on project completion. All prices exclusive of taxes."
	expiry := sampleTime{year: 2026, month: 3, day: 15}

	q := sampleQuotation{
		QuotationNumber: "QTN/2526/001",
		Status:          "DRAFT",
		Currency:        "INR",
		IssueDate:       sampleTime{year: 2026, month: 2, day: 15},
		ExpiryDate:      &expiry,
		Client: sampleClient{
			CompanyName:   "NextGen Startup Pvt. Ltd.",
			ContactPerson: &contact,
			Email:         &email,
			Phone:         &phone,
		},
		LineItems: []map[string]interface{}{
			{"description": "UI/UX Design", "qty": float64(1), "rate": float64(30000), "amount": float64(30000)},
			{"description": "Frontend Development (React)", "qty": float64(1), "rate": float64(50000), "amount": float64(50000)},
			{"description": "Backend API Development", "qty": float64(1), "rate": float64(40000), "amount": float64(40000)},
			{"description": "Cloud Deployment & DevOps", "qty": float64(1), "rate": float64(20000), "amount": float64(20000)},
		},
		Subtotal:        140000,
		GrandTotal:      140000,
		ServicesOffered: &svcs,
		ContractTerms:   &terms,
	}

	return map[string]interface{}{
		"Quotation":     &q,
		"Company":       company,
		"DocConfig":     nil,
		"Logo":          template.URL(branding["logo"]),
		"Signature":     template.URL(branding["signature"]),
		"Stamp":         template.URL(branding["stamp"]),
		"ClientAddress": "456 Tech Hub, Mumbai, Maharashtra, 400001",
	}
}

// sampleTime is a minimal time type for template preview that supports .Format
type sampleTime struct {
	year  int
	month int
	day   int
}

func (t sampleTime) Format(layout string) string {
	return fmt.Sprintf("%02d %s %d",
		t.day,
		[...]string{"", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}[t.month],
		t.year)
}
