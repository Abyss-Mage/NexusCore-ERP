package services

import (
	"fmt"
	"math"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"gorm.io/gorm"
)

// CreateInvoice creates an invoice with auto-numbering and tax calculation
func CreateInvoice(invoice *models.Invoice) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		if !invoice.IsManualEntry {
			number, err := getNextInvoiceNumber(tx, invoice.IssueDate)
			if err != nil {
				return err
			}
			invoice.InvoiceNumber = number
		}

		// Calculate tax
		var client models.Client
		if err := tx.First(&client, invoice.ClientID).Error; err != nil {
			return fmt.Errorf("client not found: %w", err)
		}

		taxBreakdown := CalculateTax(invoice.Subtotal)

		invoice.TaxSummary = models.JSONMap{
			"tax_type": taxBreakdown.TaxType,
			"rate":     taxBreakdown.Rate,
			"amount":   taxBreakdown.Amount,
			"taxes":    taxBreakdown.Taxes,
		}
		invoice.GrandTotal = invoice.Subtotal + taxBreakdown.Amount

		return tx.Create(invoice).Error
	})
}

func getNextInvoiceNumber(tx *gorm.DB, issueDate time.Time) (string, error) {
	fiscalYear := utils.GetFiscalYear(issueDate)

	var seq models.InvoiceSequence
	result := tx.Where("fiscal_year = ?", fiscalYear).First(&seq)

	if result.Error != nil {
		seq = models.InvoiceSequence{FiscalYear: fiscalYear, LastCount: 1}
		if err := tx.Create(&seq).Error; err != nil {
			return "", err
		}
	} else {
		seq.LastCount++
		if err := tx.Save(&seq).Error; err != nil {
			return "", err
		}
	}

	// Get format from settings, default to INV/{FY}/{SEQ:3}
	format := getInvoiceFormat()
	return formatDocumentNumber(format, fiscalYear, seq.LastCount, issueDate), nil
}

// CreateQuotation creates a quotation with auto-numbering
func CreateQuotation(quotation *models.Quotation) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		if !quotation.IsManualEntry {
			number, err := getNextQuotationNumber(tx, quotation.IssueDate)
			if err != nil {
				return err
			}
			quotation.QuotationNumber = number
		}

		return tx.Create(quotation).Error
	})
}

func getNextQuotationNumber(tx *gorm.DB, issueDate time.Time) (string, error) {
	fiscalYear := utils.GetFiscalYear(issueDate)

	var seq models.QuotationSequence
	result := tx.Where("fiscal_year = ?", fiscalYear).First(&seq)

	if result.Error != nil {
		seq = models.QuotationSequence{FiscalYear: fiscalYear, LastCount: 1}
		if err := tx.Create(&seq).Error; err != nil {
			return "", err
		}
	} else {
		seq.LastCount++
		if err := tx.Save(&seq).Error; err != nil {
			return "", err
		}
	}

	format := getQuotationFormat()
	return formatDocumentNumber(format, fiscalYear, seq.LastCount, issueDate), nil
}

func getInvoiceFormat() string {
	var settings []models.SystemSetting
	database.DB.Where("key = ?", "INVOICE_FORMAT").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].Value == nil {
		return "INV/{FY}/{SEQ:3}"
	}
	return *settings[0].Value
}

func getQuotationFormat() string {
	var settings []models.SystemSetting
	database.DB.Where("key = ?", "QUOTATION_FORMAT").Limit(1).Find(&settings)
	if len(settings) == 0 || settings[0].Value == nil {
		return "QTN/{FY}/{SEQ:3}"
	}
	return *settings[0].Value
}

func formatDocumentNumber(format, fiscalYear string, seq int, date time.Time) string {
	result := format

	// Replace {FY}
	result = replaceTag(result, "{FY}", fiscalYear)

	// Replace {YYYY}
	result = replaceTag(result, "{YYYY}", fmt.Sprintf("%d", date.Year()))

	// Replace {MM}
	result = replaceTag(result, "{MM}", fmt.Sprintf("%02d", date.Month()))

	// Replace {DD}
	result = replaceTag(result, "{DD}", fmt.Sprintf("%02d", date.Day()))

	// Replace {SEQ:n}
	for n := 1; n <= 10; n++ {
		tag := fmt.Sprintf("{SEQ:%d}", n)
		padded := fmt.Sprintf("%0*d", n, seq)
		result = replaceTag(result, tag, padded)
	}

	return result
}

func replaceTag(s, old, new string) string {
	for {
		i := indexOf(s, old)
		if i == -1 {
			return s
		}
		s = s[:i] + new + s[i+len(old):]
	}
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// GetDashboardSummary returns financial summary for dashboard
type DashboardSummary struct {
	TotalRevenue    float64 `json:"total_revenue"`
	TotalExpenses   float64 `json:"total_expenses"`
	NetProfit       float64 `json:"net_profit"`
	AverageSale     float64 `json:"average_sale"`
	PendingAmount   float64 `json:"pending_amount"`
	InvoiceCount    int64   `json:"invoice_count"`
	PaidCount       int64   `json:"paid_count"`
	OverdueCount    int64   `json:"overdue_count"`
}

func GetDashboardSummary(startDate, endDate time.Time) (*DashboardSummary, error) {
	var summary DashboardSummary

	// Total revenue from paid invoices (use received_amount, the actual INR received)
	database.DB.Model(&models.Invoice{}).
		Where("status = ? AND issue_date BETWEEN ? AND ?", "PAID", startDate, endDate).
		Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").Scan(&summary.TotalRevenue)

	// Add other income
	var otherIncome float64
	database.DB.Model(&models.OtherIncome{}).
		Where("date BETWEEN ? AND ?", startDate, endDate).
		Select("COALESCE(SUM(amount), 0)").Scan(&otherIncome)
	summary.TotalRevenue += otherIncome

	// Total expenses
	database.DB.Model(&models.Expense{}).
		Where("date BETWEEN ? AND ?", startDate, endDate).
		Select("COALESCE(SUM(amount), 0)").Scan(&summary.TotalExpenses)

	summary.NetProfit = summary.TotalRevenue - summary.TotalExpenses

	// Invoice counts
	database.DB.Model(&models.Invoice{}).
		Where("issue_date BETWEEN ? AND ?", startDate, endDate).
		Count(&summary.InvoiceCount)

	database.DB.Model(&models.Invoice{}).
		Where("status = ? AND issue_date BETWEEN ? AND ?", "PAID", startDate, endDate).
		Count(&summary.PaidCount)

	database.DB.Model(&models.Invoice{}).
		Where("status = ? AND issue_date BETWEEN ? AND ?", "OVERDUE", startDate, endDate).
		Count(&summary.OverdueCount)

	// Pending amount (SENT + OVERDUE + SHARED + PENDING invoices)
	database.DB.Model(&models.Invoice{}).
		Where("status IN ? AND issue_date BETWEEN ? AND ?", []string{"SENT", "OVERDUE", "SHARED", "PENDING", "PARTIAL"}, startDate, endDate).
		Select("COALESCE(SUM(grand_total), 0)").Scan(&summary.PendingAmount)

	if summary.InvoiceCount > 0 {
		summary.AverageSale = math.Round(summary.TotalRevenue/float64(summary.InvoiceCount)*100) / 100
	}

	return &summary, nil
}
