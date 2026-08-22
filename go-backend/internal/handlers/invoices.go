package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/storage"
	"github.com/gin-gonic/gin"
)

// CalculateTaxHandler computes GST breakdown for a client without creating an invoice.
func CalculateTaxHandler(c *gin.Context) {
	var req struct {
		ClientStateCode *int    `json:"clientStateCode"`
		ClientCountry   string  `json:"clientCountry"`
		Subtotal        float64 `json:"subtotal"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tax := services.CalculateTax(req.Subtotal)
	// Return in shape frontend expects: { tax_type, rate, amount, taxes: {...} }
	c.JSON(http.StatusOK, gin.H{
		"tax_type": tax.TaxType,
		"rate":     tax.Rate,
		"amount":   tax.Amount,
		"taxes":    tax.Taxes,
	})
}

// ListSharedInvoices returns recent pending/shared/sent invoices for the dashboard overview.
func ListSharedInvoices(c *gin.Context) {
	var invoices []models.Invoice
	db := database.DB.Preload("Client").
		Where("status IN ?", []string{"SHARED", "SENT", "OVERDUE", "PENDING", "PARTIAL"})

	if buID := GetContextBusinessUnitID(c); buID != "" && buID != "all" {
		db = db.Where("business_unit_id = ?", buID)
	}

	db.Order("issue_date DESC").
		Limit(25).
		Find(&invoices)

	c.JSON(http.StatusOK, invoices)
}

func ListInvoices(c *gin.Context) {
	var query dto.PaginationQuery
	c.ShouldBindQuery(&query)

	var invoices []models.Invoice
	var total int64

	db := database.DB.Model(&models.Invoice{}).Preload("Client")

	if query.Search != "" {
		search := "%" + query.Search + "%"
		db = db.Where("invoice_number ILIKE ?", search)
	}

	if status := c.Query("status"); status != "" {
		db = db.Where("status = ?", status)
	}

	if buID := GetContextBusinessUnitID(c); buID != "" && buID != "all" {
		db = db.Where("business_unit_id = ?", buID)
	}

	db.Count(&total)
	offset := (query.Page - 1) * query.Limit
	db.Order("created_at DESC").Offset(offset).Limit(query.Limit).Find(&invoices)

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       invoices,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	})
}

func GetInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice

	if err := database.DB.Preload("Client").Preload("BankAccount").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

func CreateInvoice(c *gin.Context) {
	var req dto.InvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	var lineItems models.JSONArray
	if items, ok := req.LineItems.([]interface{}); ok {
		lineItems = items
	} else {
		lineItems = models.JSONArray{}
	}

	buID := req.BusinessUnitID
	if buID == nil || *buID == "" {
		if ctxBU := GetContextBusinessUnitID(c); ctxBU != "" && ctxBU != "all" {
			buID = &ctxBU
		} else {
			defaultBU := "safehouse"
			buID = &defaultBU
		}
	}

	// Calculate subtotal from line items
	subtotal := calculateSubtotal(lineItems)

	baseCurrency := services.GetBaseCurrency()
	exchangeRate := 1.0
	if currency != baseCurrency {
		if rate, err := services.GetExchangeRate(currency, baseCurrency); err == nil {
			exchangeRate = rate
		}
	}

	invoice := models.Invoice{
		ClientID:       req.ClientID,
		BankAccountID:  req.BankAccountID,
		IssueDate:      req.IssueDate,
		DueDate:        req.DueDate,
		Currency:       currency,
		LineItems:      lineItems,
		Subtotal:       subtotal,
		Remarks:        req.Remarks,
		Category:       req.Category,
		IsManualEntry:  req.IsManualEntry,
		BaseCurrency:   baseCurrency,
		ExchangeRate:   exchangeRate,
		BusinessUnitID: buID,
	}

	if req.IsManualEntry && req.InvoiceNumber != nil {
		invoice.InvoiceNumber = *req.InvoiceNumber
	}

	if err := services.CreateInvoice(&invoice); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log activity
	userID, ok := getContextUserID(c)
	if ok {
		entityType := "INVOICE"
		entityID := strconv.Itoa(invoice.ID)
		ip := c.ClientIP()
		services.LogActivity(userID, "CREATE_INVOICE",
			"Created Invoice #"+invoice.InvoiceNumber, &entityType, &entityID, &ip)
	}

	database.DB.Preload("Client").Preload("BankAccount").First(&invoice, invoice.ID)
	_ = services.PostInvoiceJournalEntry(&invoice)
	c.JSON(http.StatusCreated, invoice)
}

func UpdateInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice

	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	if invoice.Status != "DRAFT" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only DRAFT invoices can be edited"})
		return
	}

	var req dto.InvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var lineItems models.JSONArray
	if items, ok := req.LineItems.([]interface{}); ok {
		lineItems = items
	}

	subtotal := calculateSubtotal(lineItems)

	baseCurrency := services.GetBaseCurrency()
	exchangeRate := 1.0
	if req.Currency != baseCurrency {
		if rate, err := services.GetExchangeRate(req.Currency, baseCurrency); err == nil {
			exchangeRate = rate
		}
	}

	// Recalculate tax
	taxBreakdown := services.CalculateTax(subtotal)

	// Invalidate cached PDF
	invalidateInvoicePDF(&invoice)

	if err := database.DB.Model(&invoice).Updates(map[string]interface{}{
		"client_id":       req.ClientID,
		"bank_account_id": req.BankAccountID,
		"issue_date":      req.IssueDate,
		"due_date":        req.DueDate,
		"currency":        req.Currency,
		"base_currency":   baseCurrency,
		"exchange_rate":   exchangeRate,
		"line_items":      lineItems,
		"subtotal":        subtotal,
		"grand_total":     subtotal + taxBreakdown.Amount,
		"tax_summary": models.JSONMap{
			"tax_type": taxBreakdown.TaxType,
			"rate":     taxBreakdown.Rate,
			"amount":   taxBreakdown.Amount,
			"taxes":    taxBreakdown.Taxes,
		},
		"remarks":  req.Remarks,
		"category": req.Category,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invoice"})
		return
	}

	database.DB.Preload("Client").Preload("BankAccount").First(&invoice, id)
	_ = services.PostInvoiceJournalEntry(&invoice)
	c.JSON(http.StatusOK, invoice)
}

func UpdateInvoiceStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice

	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	var req dto.InvoiceStatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Invalidate cached PDF on status change
	invalidateInvoicePDF(&invoice)

	updates := map[string]interface{}{"status": req.Status}

	if req.Status == "PAID" {
		now := time.Now()
		if req.PaymentDate != nil {
			updates["payment_date"] = req.PaymentDate
		} else {
			updates["payment_date"] = now
		}
		if req.ReceivedAmount != nil {
			updates["received_amount"] = req.ReceivedAmount
		}
	}

	if err := database.DB.Model(&invoice).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invoice status"})
		return
	}

	database.DB.Preload("Client").First(&invoice, id)
	_ = services.PostInvoiceJournalEntry(&invoice)
	if req.Status == "PAID" {
		_ = services.PostInvoicePaymentJournalEntry(&invoice)

		clientName := "Client"
		if invoice.Client.CompanyName != "" {
			clientName = invoice.Client.CompanyName
		}

		services.DispatchAlert(services.AlertPayload{
			Type:      services.AlertEventInvoicePaid,
			Title:     fmt.Sprintf("💰 Invoice Paid: #%s", invoice.InvoiceNumber),
			Message:   fmt.Sprintf("Client %s has paid Invoice #%s for %s %.2f!", clientName, invoice.InvoiceNumber, invoice.Currency, invoice.GrandTotal),
			Severity:  "SUCCESS",
			Timestamp: time.Now(),
			Details: map[string]interface{}{
				"invoice_number": invoice.InvoiceNumber,
				"client_name":    clientName,
				"amount":         fmt.Sprintf("%s %.2f", invoice.Currency, invoice.GrandTotal),
				"status":         "PAID",
			},
		})
	}

	if userID, ok := getContextUserID(c); ok {
		entityType := "INVOICE"
		entityID := strconv.Itoa(invoice.ID)
		ip := c.ClientIP()
		services.LogActivity(userID, "UPDATE_INVOICE_STATUS",
			"Updated Invoice #"+invoice.InvoiceNumber+" to "+req.Status, &entityType, &entityID, &ip)
	}

	c.JSON(http.StatusOK, invoice)
}

func DeleteInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice

	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	invalidateInvoicePDF(&invoice)
	database.DB.Delete(&invoice)
	c.JSON(http.StatusOK, gin.H{"message": "Invoice deleted"})
}

func DeleteInvoicePDF(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice

	if err := database.DB.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	invalidateInvoicePDF(&invoice)
	c.JSON(http.StatusOK, gin.H{"message": "Cached PDF deleted"})
}

func invalidateInvoicePDF(inv *models.Invoice) {
	if inv.PDFKey != nil && *inv.PDFKey != "" && storage.IsConnected() {
		storage.DeleteObject(storage.BucketInvoices, *inv.PDFKey)
	}
	database.DB.Model(inv).Update("pdf_key", nil)
}

func GetInvoicePDF(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	regen := c.Query("regenerate") == "true"
	var invoice models.Invoice

	if err := database.DB.Preload("Client").Preload("BankAccount").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	// Serve cached PDF from MinIO if available (and not forced regenerate)
	if !regen && invoice.PDFKey != nil && *invoice.PDFKey != "" && storage.IsConnected() {
		if obj, err := storage.GetObject(storage.BucketInvoices, *invoice.PDFKey); err == nil {
			defer obj.Close()
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", "inline; filename="+invoice.InvoiceNumber+".pdf")
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	// Generate fresh PDF
	pdfBytes, err := generateInvoicePDF(&invoice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Store in MinIO
	if storage.IsConnected() {
		key := fmt.Sprintf("%s/%s.pdf", time.Now().Format("2006/01"), invoice.InvoiceNumber)
		reader := bytes.NewReader(pdfBytes)
		if err := storage.PutObject(storage.BucketInvoices, key, reader, int64(len(pdfBytes)), "application/pdf"); err == nil {
			database.DB.Model(&invoice).Update("pdf_key", key)
		}
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "inline; filename="+invoice.InvoiceNumber+".pdf")
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// GetInvoicePDFData returns all necessary JSON data for frontend PDF generation
func GetInvoicePDFData(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var invoice models.Invoice

	if err := database.DB.Preload("Client").Preload("BankAccount").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	var companySetting []models.SystemSetting
	database.DB.Where("key = ?", "company").Limit(1).Find(&companySetting)
	var company map[string]interface{}
	if len(companySetting) > 0 && companySetting[0].JSONValue != nil {
		company = map[string]interface{}(*companySetting[0].JSONValue)
	}

	branding := services.LoadBrandingAssets(company)
	taxRows := buildTaxRows(invoice.TaxSummary)

	c.JSON(http.StatusOK, gin.H{
		"Invoice":       invoice,
		"Company":       company,
		"Logo":          branding["logo"],
		"Signature":     branding["signature"],
		"Stamp":         branding["stamp"],
		"TaxRows":       taxRows,
		"ClientAddress": extractClientAddress(invoice.Client.Addresses),
	})
}

// generateInvoicePDF renders the HTML template and converts it to PDF bytes.
func generateInvoicePDF(invoice *models.Invoice) ([]byte, error) {
	var companySetting []models.SystemSetting
	database.DB.Where("key = ?", "company").Limit(1).Find(&companySetting)
	var company map[string]interface{}
	if len(companySetting) > 0 && companySetting[0].JSONValue != nil {
		company = map[string]interface{}(*companySetting[0].JSONValue)
	}

	var docSetting []models.SystemSetting
	database.DB.Where("key = ?", "documents").Limit(1).Find(&docSetting)
	var docConfig map[string]interface{}
	if len(docSetting) > 0 && docSetting[0].JSONValue != nil {
		docConfig = map[string]interface{}(*docSetting[0].JSONValue)
	}

	branding := services.LoadBrandingAssets(company)

	// Extract tax details for easy template access
	tax := invoice.TaxSummary
	taxRows := buildTaxRows(tax)

	data := map[string]interface{}{
		"Invoice":       invoice,
		"Company":       company,
		"DocConfig":     docConfig,
		"Logo":          template.URL(branding["logo"]),
		"Signature":     template.URL(branding["signature"]),
		"Stamp":         template.URL(branding["stamp"]),
		"TaxRows":       taxRows,
		"ClientAddress": extractClientAddress(invoice.Client.Addresses),
	}

	// Resolve active template (built-in or custom)
	tmplContent := ResolveActiveTemplate("invoice")

	htmlContent, err := services.RenderTemplate(tmplContent, data)
	if err != nil {
		return nil, fmt.Errorf("template rendering failed: %w", err)
	}

	pdfBytes, err := services.GeneratePDF(htmlContent)
	if err != nil {
		return nil, fmt.Errorf("PDF generation failed: %w", err)
	}
	return pdfBytes, nil
}

type taxRow struct {
	Label  string
	Amount string
}

func buildTaxRows(tax models.JSONMap) []taxRow {
	var rows []taxRow
	if tax == nil {
		return rows
	}
	getFloat := func(key string) float64 {
		if v, ok := tax[key]; ok {
			switch f := v.(type) {
			case float64:
				return f
			case int:
				return float64(f)
			}
		}
		return 0
	}

	if cgst := getFloat("cgst"); cgst > 0 {
		rate := getFloat("cgst_rate")
		if rate == 0 { rate = 9 }
		rows = append(rows, taxRow{Label: fmt.Sprintf("CGST (%.0f%%)", rate), Amount: fmt.Sprintf("%.2f", cgst)})
	}
	if sgst := getFloat("sgst"); sgst > 0 {
		rate := getFloat("sgst_rate")
		if rate == 0 { rate = 9 }
		rows = append(rows, taxRow{Label: fmt.Sprintf("SGST (%.0f%%)", rate), Amount: fmt.Sprintf("%.2f", sgst)})
	}
	if igst := getFloat("igst"); igst > 0 {
		rate := getFloat("igst_rate")
		if rate == 0 { rate = 18 }
		rows = append(rows, taxRow{Label: fmt.Sprintf("IGST (%.0f%%)", rate), Amount: fmt.Sprintf("%.2f", igst)})
	}

	// Dynamic taxes mapped from the new system
	if taxes, ok := tax["taxes"].(map[string]interface{}); ok {
		for k, v := range taxes {
			if val, ok := v.(float64); ok && val > 0 {
				rows = append(rows, taxRow{Label: k, Amount: fmt.Sprintf("%.2f", val)})
			}
		}
	}
	
	return rows
}

func defaultInvoiceTemplate() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.5}
.page{padding:40px 45px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #2563eb;margin-bottom:25px}
.header-left{display:flex;align-items:center;gap:16px}
.logo{max-height:70px;max-width:180px;object-fit:contain}
.company-name{font-size:22px;font-weight:700;color:#2563eb}
.company-details{font-size:11px;color:#64748b;margin-top:4px}
.company-details span{display:block}
.doc-title{font-size:32px;font-weight:800;color:#1e293b;letter-spacing:-0.5px}
.doc-number{font-size:14px;color:#64748b;text-align:right;margin-top:4px}
.meta-row{display:flex;justify-content:space-between;margin-bottom:25px}
.meta-block{width:48%}
.meta-block h3{font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;margin-bottom:8px;font-weight:600}
.meta-block p{margin:2px 0;font-size:12px;color:#334155}
.meta-block .name{font-size:14px;font-weight:600;color:#1e293b}
table.items{width:100%;border-collapse:collapse;margin:0 0 20px}
table.items th{background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:600}
table.items td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155}
table.items tr:last-child td{border-bottom:none}
.text-right{text-align:right}
.summary-section{display:flex;justify-content:space-between;margin-top:10px}
.bank-section{width:55%;font-size:11px;color:#475569}
.bank-section h4{font-size:12px;font-weight:600;color:#1e293b;margin-bottom:6px}
.bank-section p{margin:1px 0}
.totals-section{width:40%}
.totals-section table{width:100%;border-collapse:collapse}
.totals-section td{padding:5px 10px;font-size:12px}
.totals-section .label{color:#64748b;text-align:left}
.totals-section .value{text-align:right;font-weight:500}
.totals-section .grand-total td{font-size:16px;font-weight:700;color:#2563eb;border-top:2px solid #2563eb;padding-top:10px}
.auth-section{display:flex;justify-content:flex-end;margin-top:40px;padding-top:20px}
.auth-block{text-align:center;position:relative;min-width:200px}
.stamp-img{max-height:80px;max-width:120px;object-fit:contain;opacity:0.8;position:absolute;top:-30px;left:50%;transform:translateX(-50%)}
.sig-img{max-height:60px;max-width:160px;object-fit:contain;margin-bottom:8px}
.sig-line{border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#64748b}
.remarks{margin-top:25px;padding:12px 16px;background:#f8fafc;border-radius:6px;border-left:3px solid #2563eb;font-size:11px;color:#475569}
.remarks strong{color:#1e293b}
.footer{margin-top:30px;padding-top:15px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}
</style></head><body>
<div class="page">

<div class="header">
<div class="header-left">
{{if .Logo}}<img class="logo" src="{{.Logo}}" alt="Logo"/>{{end}}
<div>
<div class="company-name">{{with .Company}}{{index . "company_name"}}{{else}}Company{{end}}</div>
<div class="company-details">
{{with .Company}}{{with index . "gstin"}}<span>GSTIN: {{.}}</span>{{end}}{{with index . "cin"}}<span>CIN: {{.}}</span>{{end}}{{with index . "address"}}<span>{{.}}</span>{{end}}{{with index . "phone"}}<span>Ph: {{.}}</span>{{end}}{{with index . "email"}}<span>{{.}}</span>{{end}}{{end}}
</div>
</div>
</div>
<div style="text-align:right">
<div class="doc-title">INVOICE</div>
<div class="doc-number">{{.Invoice.InvoiceNumber}}</div>
</div>
</div>

<div class="meta-row">
<div class="meta-block">
<h3>Bill To</h3>
<p class="name">{{.Invoice.Client.CompanyName}}</p>
{{with .Invoice.Client.ContactPerson}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.Email}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.Phone}}<p>{{.}}</p>{{end}}
{{with .ClientAddress}}<p>{{.}}</p>{{end}}
{{with .Invoice.Client.TaxID}}<p style="margin-top:4px;font-weight:500">GSTIN: {{.}}</p>{{end}}
</div>
<div class="meta-block" style="text-align:right">
<h3>Invoice Details</h3>
<p><strong>Date:</strong> {{.Invoice.IssueDate.Format "02 Jan 2006"}}</p>
{{with .Invoice.DueDate}}<p><strong>Due:</strong> {{.Format "02 Jan 2006"}}</p>{{end}}
<p><strong>Status:</strong> {{.Invoice.Status}}</p>
<p><strong>Currency:</strong> {{.Invoice.Currency}}</p>
</div>
</div>

<table class="items">
<thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody>
{{range $i, $item := .Invoice.LineItems}}
<tr>
<td>{{inc $i}}</td>
<td>{{index $item "description"}}</td>
<td>{{with index $item "hsn"}}{{.}}{{end}}</td>
<td class="text-right">{{index $item "qty"}}</td>
<td class="text-right">{{index $item "rate"}}</td>
<td class="text-right">{{index $item "amount"}}</td>
</tr>
{{end}}
</tbody>
</table>

<div class="summary-section">
<div class="bank-section">
{{with .Invoice.BankAccount}}
<h4>Bank Details</h4>
<p><strong>Bank:</strong> {{.BankName}}</p>
<p><strong>A/C:</strong> {{.AccountNumber}}</p>
{{with .IFSCCode}}<p><strong>IFSC:</strong> {{.}}</p>{{end}}
{{with .SwiftCode}}<p><strong>SWIFT:</strong> {{.}}</p>{{end}}
{{with .UPIID}}<p><strong>UPI:</strong> {{.}}</p>{{end}}
{{end}}
</div>
<div class="totals-section">
<table>
<tr><td class="label">Subtotal</td><td class="value">{{printf "%.2f" .Invoice.Subtotal}}</td></tr>
{{range .TaxRows}}<tr><td class="label">{{.Label}}</td><td class="value">{{.Amount}}</td></tr>{{end}}
<tr class="grand-total"><td class="label">Grand Total ({{.Invoice.Currency}})</td><td class="value">{{printf "%.2f" .Invoice.GrandTotal}}</td></tr>
</table>
</div>
</div>

{{with .Invoice.Remarks}}<div class="remarks"><strong>Remarks:</strong> {{.}}</div>{{end}}

<div class="auth-section">
<div class="auth-block">
{{if $.Stamp}}<img class="stamp-img" src="{{$.Stamp}}" alt="Stamp"/>{{end}}
{{if $.Signature}}<img class="sig-img" src="{{$.Signature}}" alt="Signature"/>{{end}}
<div class="sig-line">Authorized Signatory</div>
</div>
</div>

<div class="footer">Generated by InvoiceCore</div>
</div>
</body></html>`
}

// getContextUserID safely extracts user ID from Gin context set by AuthRequired middleware.
// Returns 0, false if missing or wrong type — callers that need a valid ID should abort on false.
func getContextUserID(c *gin.Context) (int, bool) {
	v, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	id, ok := v.(int)
	return id, ok
}

func calculateSubtotal(lineItems models.JSONArray) float64 {
	var subtotal float64
	for _, item := range lineItems {
		if m, ok := item.(map[string]interface{}); ok {
			qty := getFloat(m, "qty", 1)
			if qty == 1 {
				qty = getFloat(m, "quantity", 1)
			}
			rate := getFloat(m, "rate", 0)
			subtotal += qty * rate
		}
	}
	return subtotal
}

func getFloat(m map[string]interface{}, key string, def float64) float64 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case float64:
			return val
		case int:
			return float64(val)
		}
	}
	return def
}

// extractClientAddress builds a display address from the client's Addresses JSONMap.
func extractClientAddress(addresses *models.JSONMap) string {
	if addresses == nil {
		return ""
	}
	m := map[string]interface{}(*addresses)
	// Try common address field patterns
	parts := []string{}
	for _, key := range []string{"billing_address", "address", "street", "billing"} {
		if v, ok := m[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				parts = append(parts, s)
				break
			}
		}
	}
	for _, key := range []string{"city", "billing_city"} {
		if v, ok := m[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				parts = append(parts, s)
				break
			}
		}
	}
	for _, key := range []string{"state", "billing_state"} {
		if v, ok := m[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				parts = append(parts, s)
				break
			}
		}
	}
	for _, key := range []string{"pincode", "zip", "postal_code", "billing_pincode"} {
		if v, ok := m[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				parts = append(parts, s)
				break
			}
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, ", ")
}
