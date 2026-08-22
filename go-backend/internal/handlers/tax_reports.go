package handlers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

type B2BInvoiceRecord struct {
	InvoiceID        int     `json:"invoice_id"`
	InvoiceNumber    string  `json:"invoice_number"`
	IssueDate        string  `json:"issue_date"`
	ClientName       string  `json:"client_name"`
	ClientGSTIN      string  `json:"client_gstin"`
	StateCode        string  `json:"state_code"`
	PlaceOfSupply    string  `json:"place_of_supply"`
	ReverseCharge    string  `json:"reverse_charge"` // Y / N
	TaxableValue     float64 `json:"taxable_value"`
	IGSTAmount       float64 `json:"igst_amount"`
	CGSTAmount       float64 `json:"cgst_amount"`
	SGSTAmount       float64 `json:"sgst_amount"`
	TotalInvoiceVal  float64 `json:"total_invoice_value"`
	Currency         string  `json:"currency"`
	Status           string  `json:"status"`
}

type HSNSACSummaryRecord struct {
	Code         string  `json:"code"`
	Description  string  `json:"description"`
	UQC          string  `json:"uqc"` // Unit Quantity Code e.g. NOS, HRS, OTH
	TotalQty     float64 `json:"total_qty"`
	TotalValue   float64 `json:"total_value"`
	TaxableValue float64 `json:"taxable_value"`
	IGSTAmount   float64 `json:"igst_amount"`
	CGSTAmount   float64 `json:"cgst_amount"`
	SGSTAmount   float64 `json:"sgst_amount"`
	TaxRate      float64 `json:"tax_rate"`
}

type GSTReportSummary struct {
	CompanyGSTIN        string                `json:"company_gstin"`
	CompanyName         string                `json:"company_name"`
	FiscalYear          string                `json:"fiscal_year"`
	TotalB2BCount       int                   `json:"total_b2b_count"`
	TotalTaxableValue   float64               `json:"total_taxable_value"`
	TotalIGST           float64               `json:"total_igst"`
	TotalCGST           float64               `json:"total_cgst"`
	TotalSGST           float64               `json:"total_sgst"`
	TotalTax            float64               `json:"total_tax"`
	TotalInvoiceValue   float64               `json:"total_invoice_value"`
	B2BInvoices         []B2BInvoiceRecord    `json:"b2b_invoices"`
	HSNSACSummary       []HSNSACSummaryRecord `json:"hsn_sac_summary"`
}

// GetGSTSummaryReport generates full GSTR-1 tax compliance analysis
func GetGSTSummaryReport(c *gin.Context) {
	summary, err := buildGSTSummary(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compile GST summary: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// ExportGSTCSV exports standard GSTR-1 B2B CSV for tax portals
func ExportGSTCSV(c *gin.Context) {
	summary, err := buildGSTSummary(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	buf := new(bytes.Buffer)
	writer := csv.NewWriter(buf)

	// GSTR-1 B2B Standard Headers
	writer.Write([]string{
		"GSTIN/UIN of Recipient",
		"Receiver Name",
		"Invoice Number",
		"Invoice date",
		"Invoice Value",
		"Place Of Supply",
		"Reverse Charge",
		"Applicable % of Tax Rate",
		"Invoice Type",
		"E-Commerce GSTIN",
		"Rate",
		"Taxable Value",
		"Cess Amount",
	})

	for _, inv := range summary.B2BInvoices {
		taxRate := 18.0 // standard default
		if inv.TaxableValue > 0 {
			totTax := inv.IGSTAmount + inv.CGSTAmount + inv.SGSTAmount
			taxRate = math.Round((totTax / inv.TaxableValue) * 100.0)
		}

		writer.Write([]string{
			inv.ClientGSTIN,
			inv.ClientName,
			inv.InvoiceNumber,
			inv.IssueDate,
			fmt.Sprintf("%.2f", inv.TotalInvoiceVal),
			inv.PlaceOfSupply,
			inv.ReverseCharge,
			"",
			"Regular",
			"",
			fmt.Sprintf("%.1f", taxRate),
			fmt.Sprintf("%.2f", inv.TaxableValue),
			"0.00",
		})
	}

	writer.Flush()

	filename := fmt.Sprintf("GSTR1_B2B_Report_%s.csv", time.Now().Format("20060102_150405"))
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "text/csv", buf.Bytes())
}

// ExportGSTJSON exports GSTR-1 JSON
func ExportGSTJSON(c *gin.Context) {
	summary, err := buildGSTSummary(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=GSTR1_Export_%s.json", time.Now().Format("20060102")))
	c.JSON(http.StatusOK, summary)
}

func buildGSTSummary(c *gin.Context) (*GSTReportSummary, error) {
	var invoices []models.Invoice
	query := database.DB.Preload("Client").Where("status != ?", "CANCELLED")

	if from := c.Query("from"); from != "" {
		if t, err := time.Parse("2006-01-02", from); err == nil {
			query = query.Where("issue_date >= ?", t)
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err := time.Parse("2006-01-02", to); err == nil {
			query = query.Where("issue_date <= ?", t.Add(24*time.Hour))
		}
	}

	if err := query.Order("issue_date desc").Find(&invoices).Error; err != nil {
		return nil, err
	}

	// Company Profile & GST settings
	companyGSTIN := "Unregistered"
	companyName := "Safehouse Studios"
	var profileSetting models.SystemSetting
	if err := database.DB.Where("key = ?", "COMPANY_PROFILE").First(&profileSetting).Error; err == nil && profileSetting.JSONValue != nil {
		if g, ok := (*profileSetting.JSONValue)["tax_id"].(string); ok && g != "" {
			companyGSTIN = g
		}
		if n, ok := (*profileSetting.JSONValue)["company_name"].(string); ok && n != "" {
			companyName = n
		}
	}

	hsnMap := make(map[string]*HSNSACSummaryRecord)

	summary := &GSTReportSummary{
		CompanyGSTIN: companyGSTIN,
		CompanyName:  companyName,
		FiscalYear:   "2024-2025",
	}

	for _, inv := range invoices {
		clientGSTIN := "URP" // Unregistered Person
		if inv.Client.TaxID != nil && *inv.Client.TaxID != "" {
			clientGSTIN = *inv.Client.TaxID
		}

		pos := "27-Maharashtra" // default POS
		if inv.Client.State != nil && *inv.Client.State != "" {
			pos = *inv.Client.State
		}

		// Calculate tax breakdown (IGST vs CGST+SGST)
		taxableVal := inv.Subtotal
		totalVal := inv.GrandTotal
		var igst, cgst, sgst float64

		// If interstate vs intrastate
		isInterState := false
		if len(companyGSTIN) >= 2 && len(clientGSTIN) >= 2 && clientGSTIN != "URP" {
			if companyGSTIN[:2] != clientGSTIN[:2] {
				isInterState = true
			}
		}

		totalTax := totalVal - taxableVal
		if totalTax > 0 {
			if isInterState {
				igst = totalTax
			} else {
				cgst = totalTax / 2.0
				sgst = totalTax / 2.0
			}
		}

		record := B2BInvoiceRecord{
			InvoiceID:       inv.ID,
			InvoiceNumber:   inv.InvoiceNumber,
			IssueDate:       inv.IssueDate.Format("02-Jan-2006"),
			ClientName:      inv.Client.CompanyName,
			ClientGSTIN:     clientGSTIN,
			StateCode:       inv.Client.Country,
			PlaceOfSupply:   pos,
			ReverseCharge:   "N",
			TaxableValue:    taxableVal,
			IGSTAmount:      igst,
			CGSTAmount:      cgst,
			SGSTAmount:      sgst,
			TotalInvoiceVal: totalVal,
			Currency:        inv.Currency,
			Status:          inv.Status,
		}

		summary.B2BInvoices = append(summary.B2BInvoices, record)
		summary.TotalB2BCount++
		summary.TotalTaxableValue += taxableVal
		summary.TotalIGST += igst
		summary.TotalCGST += cgst
		summary.TotalSGST += sgst
		summary.TotalInvoiceValue += totalVal

		// Parse Line Items for HSN/SAC Classification
		for _, rawItem := range inv.LineItems {
			item, ok := rawItem.(map[string]interface{})
			if !ok {
				continue
			}
			sacCode := "998311" // Default Software / IT consulting SAC
			desc := "Software Development & IT Support Services"
			uqc := "HRS"
			qty := 1.0
			rate := 18.0

			if descVal, ok := item["description"].(string); ok {
				lowerDesc := strings.ToLower(descVal)
				if strings.Contains(lowerDesc, "3d") || strings.Contains(lowerDesc, "print") || strings.Contains(lowerDesc, "filament") {
					sacCode = "3926" // HSN for 3D printed articles of plastics
					desc = "Articles of plastics & 3D printed parts"
					uqc = "NOS"
				} else if strings.Contains(lowerDesc, "domain") || strings.Contains(lowerDesc, "hosting") || strings.Contains(lowerDesc, "ssl") {
					sacCode = "998314" // Internet domain & web hosting
					desc = "Web Hosting & Domain Management Services"
					uqc = "NOS"
				}
			}

			itemAmount := 0.0
			if amt, ok := item["amount"].(float64); ok {
				itemAmount = amt
			} else if r, ok := item["rate"].(float64); ok {
				itemAmount = r
			}

			if q, ok := item["quantity"].(float64); ok && q > 0 {
				qty = q
			}

			rec, exists := hsnMap[sacCode]
			if !exists {
				rec = &HSNSACSummaryRecord{
					Code:        sacCode,
					Description: desc,
					UQC:         uqc,
					TaxRate:     rate,
				}
				hsnMap[sacCode] = rec
			}

			itemTax := itemAmount * (rate / 100.0)
			rec.TotalQty += qty
			rec.TaxableValue += itemAmount
			rec.TotalValue += (itemAmount + itemTax)

			if isInterState {
				rec.IGSTAmount += itemTax
			} else {
				rec.CGSTAmount += itemTax / 2.0
				rec.SGSTAmount += itemTax / 2.0
			}
		}
	}

	summary.TotalTax = summary.TotalIGST + summary.TotalCGST + summary.TotalSGST

	for _, rec := range hsnMap {
		rec.TaxableValue = math.Round(rec.TaxableValue*100) / 100
		rec.TotalValue = math.Round(rec.TotalValue*100) / 100
		rec.IGSTAmount = math.Round(rec.IGSTAmount*100) / 100
		rec.CGSTAmount = math.Round(rec.CGSTAmount*100) / 100
		rec.SGSTAmount = math.Round(rec.SGSTAmount*100) / 100
		summary.HSNSACSummary = append(summary.HSNSACSummary, *rec)
	}

	summary.TotalTaxableValue = math.Round(summary.TotalTaxableValue*100) / 100
	summary.TotalIGST = math.Round(summary.TotalIGST*100) / 100
	summary.TotalCGST = math.Round(summary.TotalCGST*100) / 100
	summary.TotalSGST = math.Round(summary.TotalSGST*100) / 100
	summary.TotalTax = math.Round(summary.TotalTax*100) / 100
	summary.TotalInvoiceValue = math.Round(summary.TotalInvoiceValue*100) / 100

	return summary, nil
}
