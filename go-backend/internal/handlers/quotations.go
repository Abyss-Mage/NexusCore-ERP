package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/storage"
	"github.com/gin-gonic/gin"
)

func ListQuotations(c *gin.Context) {
	var query dto.PaginationQuery
	c.ShouldBindQuery(&query)

	var quotations []models.Quotation
	var total int64

	db := database.DB.Model(&models.Quotation{}).Preload("Client")

	if query.Search != "" {
		db = db.Where("quotation_number ILIKE ?", "%"+query.Search+"%")
	}
	if status := c.Query("status"); status != "" {
		db = db.Where("status = ?", status)
	}

	db.Count(&total)
	offset := (query.Page - 1) * query.Limit
	db.Order("created_at DESC").Offset(offset).Limit(query.Limit).Find(&quotations)

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       quotations,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	})
}

func GetQuotation(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation

	if err := database.DB.Preload("Client").Preload("BankAccount").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	c.JSON(http.StatusOK, quotation)
}

func CreateQuotation(c *gin.Context) {
	var req dto.QuotationRequest
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
	}

	subtotal := calculateSubtotal(lineItems)

	baseCurrency := services.GetBaseCurrency()
	exchangeRate := 1.0
	if currency != baseCurrency {
		if rate, err := services.GetExchangeRate(currency, baseCurrency); err == nil {
			exchangeRate = rate
		}
	}

	quotation := models.Quotation{
		ClientID:        req.ClientID,
		BankAccountID:   req.BankAccountID,
		IssueDate:       req.IssueDate,
		ExpiryDate:      req.ExpiryDate,
		LineItems:       lineItems,
		ServicesOffered: req.ServicesOffered,
		ContractTerms:   req.ContractTerms,
		Remarks:         req.Remarks,
		Subtotal:        subtotal,
		GrandTotal:      subtotal,
		Currency:        currency,
		BaseCurrency:    baseCurrency,
		ExchangeRate:    exchangeRate,
		IsManualEntry:   req.IsManualEntry,
	}

	if req.IsManualEntry && req.QuotationNumber != nil {
		quotation.QuotationNumber = *req.QuotationNumber
	}

	if err := services.CreateQuotation(&quotation); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Client").Preload("BankAccount").First(&quotation, quotation.ID)
	c.JSON(http.StatusCreated, quotation)
}

func UpdateQuotation(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation

	if err := database.DB.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	var req dto.QuotationRequest
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

	// Invalidate cached PDF
	invalidateQuotationPDF(&quotation)

	database.DB.Model(&quotation).Updates(map[string]interface{}{
		"client_id":        req.ClientID,
		"bank_account_id":  req.BankAccountID,
		"issue_date":       req.IssueDate,
		"expiry_date":      req.ExpiryDate,
		"line_items":       lineItems,
		"services_offered": req.ServicesOffered,
		"contract_terms":   req.ContractTerms,
		"remarks":          req.Remarks,
		"subtotal":         subtotal,
		"grand_total":      subtotal,
		"currency":         req.Currency,
		"base_currency":    baseCurrency,
		"exchange_rate":    exchangeRate,
	})

	database.DB.Preload("Client").Preload("BankAccount").First(&quotation, id)
	c.JSON(http.StatusOK, quotation)
}

func UpdateQuotationStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation

	if err := database.DB.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invalidateQuotationPDF(&quotation)
	database.DB.Model(&quotation).Update("status", body.Status)
	c.JSON(http.StatusOK, quotation)
}

func DeleteQuotation(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation

	if err := database.DB.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	invalidateQuotationPDF(&quotation)
	database.DB.Delete(&quotation)
	c.JSON(http.StatusOK, gin.H{"message": "Quotation deleted"})
}

// ---- Quotation PDF ----

func GetQuotationPDF(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	regen := c.Query("regenerate") == "true"
	var quotation models.Quotation

	if err := database.DB.Preload("Client").Preload("BankAccount").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	// Serve cached PDF from MinIO
	if !regen && quotation.PDFKey != nil && *quotation.PDFKey != "" && storage.IsConnected() {
		if obj, err := storage.GetObject(storage.BucketInvoices, *quotation.PDFKey); err == nil {
			defer obj.Close()
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", "inline; filename="+quotation.QuotationNumber+".pdf")
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	pdfBytes, err := generateQuotationPDF(&quotation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Store in MinIO
	if storage.IsConnected() {
		key := fmt.Sprintf("quotations/%s/%s.pdf", time.Now().Format("2006/01"), quotation.QuotationNumber)
		reader := bytes.NewReader(pdfBytes)
		if err := storage.PutObject(storage.BucketInvoices, key, reader, int64(len(pdfBytes)), "application/pdf"); err == nil {
			database.DB.Model(&quotation).Update("pdf_key", key)
		}
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "inline; filename="+quotation.QuotationNumber+".pdf")
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// GetQuotationPDFData returns all necessary JSON data for frontend PDF generation
func GetQuotationPDFData(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation

	if err := database.DB.Preload("Client").Preload("BankAccount").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	var companySetting []models.SystemSetting
	database.DB.Where("key = ?", "company").Limit(1).Find(&companySetting)
	var company map[string]interface{}
	if len(companySetting) > 0 && companySetting[0].JSONValue != nil {
		company = map[string]interface{}(*companySetting[0].JSONValue)
	}

	branding := services.LoadBrandingAssets(company)

	c.JSON(http.StatusOK, gin.H{
		"Quotation":     quotation,
		"Company":       company,
		"Logo":          branding["logo"],
		"Signature":     branding["signature"],
		"Stamp":         branding["stamp"],
		"ClientAddress": extractClientAddress(quotation.Client.Addresses),
	})
}

func DeleteQuotationPDF(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var quotation models.Quotation

	if err := database.DB.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Quotation not found"})
		return
	}

	invalidateQuotationPDF(&quotation)
	c.JSON(http.StatusOK, gin.H{"message": "Cached PDF deleted"})
}

func generateQuotationPDF(quotation *models.Quotation) ([]byte, error) {
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

	data := map[string]interface{}{
		"Quotation":     quotation,
		"Company":       company,
		"DocConfig":     docConfig,
		"Logo":          template.URL(branding["logo"]),
		"Signature":     template.URL(branding["signature"]),
		"Stamp":         template.URL(branding["stamp"]),
		"ClientAddress": extractClientAddress(quotation.Client.Addresses),
	}

	// Resolve active template (built-in or custom)
	tmplContent := ResolveActiveTemplate("quotation")

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

func invalidateQuotationPDF(q *models.Quotation) {
	if q.PDFKey != nil && *q.PDFKey != "" && storage.IsConnected() {
		storage.DeleteObject(storage.BucketInvoices, *q.PDFKey)
	}
	database.DB.Model(q).Update("pdf_key", nil)
}

func defaultQuotationTemplate() string {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.5}
.page{padding:40px 45px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #7c3aed;margin-bottom:25px}
.header-left{display:flex;align-items:center;gap:16px}
.logo{max-height:70px;max-width:180px;object-fit:contain}
.company-name{font-size:22px;font-weight:700;color:#7c3aed}
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
table.items th{background:#f5f3ff;color:#6d28d9;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;padding:10px 12px;text-align:left;border-bottom:2px solid #e9e5f5;font-weight:600}
table.items td{padding:10px 12px;border-bottom:1px solid #f5f3ff;font-size:12px;color:#334155}
table.items tr:last-child td{border-bottom:none}
.text-right{text-align:right}
.summary-section{display:flex;justify-content:flex-end;margin-top:10px}
.totals-section{width:40%}
.totals-section table{width:100%;border-collapse:collapse}
.totals-section td{padding:5px 10px;font-size:12px}
.totals-section .label{color:#64748b;text-align:left}
.totals-section .value{text-align:right;font-weight:500}
.totals-section .grand-total td{font-size:16px;font-weight:700;color:#7c3aed;border-top:2px solid #7c3aed;padding-top:10px}
.section-box{margin-top:20px;padding:14px 16px;background:#faf8ff;border-radius:6px;border-left:3px solid #7c3aed;font-size:12px;color:#475569}
.section-box h4{font-size:13px;font-weight:600;color:#1e293b;margin-bottom:6px}
.auth-section{display:flex;justify-content:flex-end;margin-top:40px;padding-top:20px}
.auth-block{text-align:center;position:relative;min-width:200px}
.stamp-img{max-height:80px;max-width:120px;object-fit:contain;opacity:0.8;position:absolute;top:-30px;left:50%;transform:translateX(-50%)}
.sig-img{max-height:60px;max-width:160px;object-fit:contain;margin-bottom:8px}
.sig-line{border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#64748b}
.validity{margin-top:15px;padding:10px 16px;background:#fef9c3;border-radius:6px;font-size:11px;color:#854d0e;text-align:center;font-weight:500}
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
<div class="doc-title">QUOTATION</div>
<div class="doc-number">{{.Quotation.QuotationNumber}}</div>
</div>
</div>

<div class="meta-row">
<div class="meta-block">
<h3>Prepared For</h3>
<p class="name">{{.Quotation.Client.CompanyName}}</p>
{{with .Quotation.Client.ContactPerson}}<p>{{.}}</p>{{end}}
{{with .Quotation.Client.Email}}<p>{{.}}</p>{{end}}
{{with .Quotation.Client.Phone}}<p>{{.}}</p>{{end}}
{{with .ClientAddress}}<p>{{.}}</p>{{end}}
</div>
<div class="meta-block" style="text-align:right">
<h3>Quotation Details</h3>
<p><strong>Date:</strong> {{.Quotation.IssueDate.Format "02 Jan 2006"}}</p>
{{with .Quotation.ExpiryDate}}<p><strong>Valid Until:</strong> {{.Format "02 Jan 2006"}}</p>{{end}}
<p><strong>Status:</strong> {{.Quotation.Status}}</p>
<p><strong>Currency:</strong> {{.Quotation.Currency}}</p>
</div>
</div>

<table class="items">
<thead><tr><th>#</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
<tbody>
{{range $i, $item := .Quotation.LineItems}}
<tr>
<td>{{inc $i}}</td>
<td>{{index $item "description"}}</td>
<td class="text-right">{{index $item "qty"}}</td>
<td class="text-right">{{index $item "rate"}}</td>
<td class="text-right">{{index $item "amount"}}</td>
</tr>
{{end}}
</tbody>
</table>

<div class="summary-section">
<div class="totals-section">
<table>
<tr><td class="label">Subtotal</td><td class="value">{{printf "%.2f" .Quotation.Subtotal}}</td></tr>
<tr class="grand-total"><td class="label">Total ({{.Quotation.Currency}})</td><td class="value">{{printf "%.2f" .Quotation.GrandTotal}}</td></tr>
</table>
</div>
</div>

{{with .Quotation.ServicesOffered}}<div class="section-box"><h4>Services Offered</h4>{{.}}</div>{{end}}
{{with .Quotation.ContractTerms}}<div class="section-box"><h4>Terms & Conditions</h4>{{.}}</div>{{end}}
{{with .Quotation.Remarks}}<div class="section-box"><h4>Remarks</h4>{{.}}</div>{{end}}

{{with .Quotation.ExpiryDate}}<div class="validity">⏰ This quotation is valid until {{.Format "02 January 2006"}}.</div>{{end}}

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
