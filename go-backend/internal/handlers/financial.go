package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

// ---- Expenses ----

func ListExpenses(c *gin.Context) {
	var query dto.PaginationQuery
	c.ShouldBindQuery(&query)

	var expenses []models.Expense
	var total int64

	db := database.DB.Model(&models.Expense{})

	if category := c.Query("category"); category != "" {
		db = db.Where("category = ?", category)
	}
	if startDate := c.Query("start_date"); startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			db = db.Where("date >= ?", t)
		}
	}
	if endDate := c.Query("end_date"); endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			db = db.Where("date <= ?", t)
		}
	}

	db.Count(&total)
	offset := (query.Page - 1) * query.Limit
	db.Order("date DESC").Offset(offset).Limit(query.Limit).Find(&expenses)

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       expenses,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	})
}

func CreateExpense(c *gin.Context) {
	var req dto.ExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expense := models.Expense{
		Category:    req.Category,
		Amount:      req.Amount,
		Date:        req.Date,
		Description: req.Description,
	}

	if err := database.DB.Create(&expense).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create expense"})
		return
	}
	c.JSON(http.StatusCreated, expense)
}

func UpdateExpense(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var expense models.Expense

	if err := database.DB.First(&expense, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}

	var req dto.ExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&expense).Updates(models.Expense{
		Category:    req.Category,
		Amount:      req.Amount,
		Date:        req.Date,
		Description: req.Description,
	})

	c.JSON(http.StatusOK, expense)
}

func DeleteExpense(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	result := database.DB.Delete(&models.Expense{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Expense deleted"})
}

// ---- Other Income ----

func ListOtherIncome(c *gin.Context) {
	var query dto.PaginationQuery
	c.ShouldBindQuery(&query)

	var income []models.OtherIncome
	var total int64

	db := database.DB.Model(&models.OtherIncome{})

	if startDate := c.Query("start_date"); startDate != "" {
		if t, err := time.Parse("2006-01-02", startDate); err == nil {
			db = db.Where("date >= ?", t)
		}
	}
	if endDate := c.Query("end_date"); endDate != "" {
		if t, err := time.Parse("2006-01-02", endDate); err == nil {
			db = db.Where("date <= ?", t)
		}
	}

	db.Count(&total)
	offset := (query.Page - 1) * query.Limit
	db.Order("date DESC").Offset(offset).Limit(query.Limit).Find(&income)

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       income,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	})
}

func CreateOtherIncome(c *gin.Context) {
	var req dto.OtherIncomeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	income := models.OtherIncome{
		Category:    req.Category,
		Amount:      req.Amount,
		Date:        req.Date,
		Description: req.Description,
	}

	if err := database.DB.Create(&income).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create income"})
		return
	}
	c.JSON(http.StatusCreated, income)
}

func UpdateOtherIncome(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var income models.OtherIncome

	if err := database.DB.First(&income, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Income not found"})
		return
	}

	var req dto.OtherIncomeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&income).Updates(models.OtherIncome{
		Category:    req.Category,
		Amount:      req.Amount,
		Date:        req.Date,
		Description: req.Description,
	})

	c.JSON(http.StatusOK, income)
}

func DeleteOtherIncome(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	result := database.DB.Delete(&models.OtherIncome{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Income not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Income deleted"})
}

// ---- Bank Accounts ----

func ListBankAccounts(c *gin.Context) {
	var accounts []models.BankAccount
	database.DB.Order("is_default DESC, created_at DESC").Find(&accounts)
	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       accounts,
		Total:      int64(len(accounts)),
		Page:       1,
		Limit:      len(accounts),
		TotalPages: 1,
	})
}

func GetBankAccount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var account models.BankAccount

	if err := database.DB.First(&account, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bank account not found"})
		return
	}

	c.JSON(http.StatusOK, account)
}

func CreateBankAccount(c *gin.Context) {
	var req dto.BankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.IsDefault {
		database.DB.Model(&models.BankAccount{}).Where("is_default = ?", true).Update("is_default", false)
	}

	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}

	account := models.BankAccount{
		Label:         req.Label,
		Currency:      currency,
		IsDefault:     req.IsDefault,
		BankName:      req.BankName,
		AccountHolder: req.AccountHolder,
		AccountNumber: req.AccountNumber,
		RoutingNumber: req.RoutingNumber,
		SwiftCode:     req.SwiftCode,
		IFSCCode:      req.IFSCCode,
		IBAN:          req.IBAN,
		SortCode:      req.SortCode,
		BranchAddress: req.BranchAddress,
		UPIID:         req.UPIID,
		PaymentMethod: req.PaymentMethod,
	}

	if err := database.DB.Create(&account).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bank account"})
		return
	}
	c.JSON(http.StatusCreated, account)
}

func UpdateBankAccount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var account models.BankAccount

	if err := database.DB.First(&account, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bank account not found"})
		return
	}

	var req dto.BankAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.IsDefault {
		database.DB.Model(&models.BankAccount{}).Where("id != ? AND is_default = ?", id, true).Update("is_default", false)
	}

	database.DB.Model(&account).Updates(map[string]interface{}{
		"label":          req.Label,
		"currency":       req.Currency,
		"is_default":     req.IsDefault,
		"bank_name":      req.BankName,
		"account_holder": req.AccountHolder,
		"account_number": req.AccountNumber,
		"routing_number": req.RoutingNumber,
		"swift_code":     req.SwiftCode,
		"ifsc_code":      req.IFSCCode,
		"iban":           req.IBAN,
		"sort_code":      req.SortCode,
		"branch_address": req.BranchAddress,
		"upi_id":         req.UPIID,
		"payment_method": req.PaymentMethod,
	})

	c.JSON(http.StatusOK, account)
}

func DeleteBankAccount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	result := database.DB.Delete(&models.BankAccount{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bank account not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bank account deleted"})
}

func SetDefaultBankAccount(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	// Clear existing default
	database.DB.Model(&models.BankAccount{}).Where("is_default = ?", true).Update("is_default", false)
	// Set new default
	result := database.DB.Model(&models.BankAccount{}).Where("id = ?", id).Update("is_default", true)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bank account not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Default bank account updated"})
}

// ---- Ledger ----

func GetLedger(c *gin.Context) {
	// Unified ledger entry format expected by frontend
	type UnifiedEntry struct {
		ID          string  `json:"id"`
		Date        string  `json:"date"`
		Description string  `json:"description"`
		Type        string  `json:"type"`
		Category    string  `json:"category"`
		Credit      float64 `json:"credit"`
		Debit       float64 `json:"debit"`
	}

	var entries []UnifiedEntry

	// 1. Invoices (PAID = credit, SENT/OVERDUE = pending shown as credit)
	var invoices []models.Invoice
	database.DB.Preload("Client").Where("status IN ?", []string{"SENT", "PAID", "OVERDUE"}).
		Order("issue_date ASC").Find(&invoices)
	for _, inv := range invoices {
		credit := 0.0
		if inv.Status == "PAID" {
			if inv.ReceivedAmount != nil {
				credit = *inv.ReceivedAmount
			} else {
				credit = inv.GrandTotal
			}
		}
		date := inv.IssueDate.Format("2006-01-02")
		if inv.Status == "PAID" && inv.PaymentDate != nil {
			date = inv.PaymentDate.Format("2006-01-02")
		}
		entries = append(entries, UnifiedEntry{
			ID:          "INV-" + strconv.Itoa(inv.ID),
			Date:        date,
			Description: "Invoice #" + inv.InvoiceNumber + " — " + inv.Client.CompanyName,
			Type:        "Invoice",
			Category:    inv.Status,
			Credit:      credit,
			Debit:       0,
		})
	}

	// 2. Expenses
	var expenses []models.Expense
	database.DB.Order("date ASC").Find(&expenses)
	for _, exp := range expenses {
		desc := ""
		if exp.Description != nil {
			desc = *exp.Description
		}
		entries = append(entries, UnifiedEntry{
			ID:          "EXP-" + strconv.Itoa(exp.ID),
			Date:        exp.Date.Format("2006-01-02"),
			Description: desc,
			Type:        "Expense",
			Category:    exp.Category,
			Credit:      0,
			Debit:       exp.Amount,
		})
	}

	// 3. Other Income
	var incomes []models.OtherIncome
	database.DB.Order("date ASC").Find(&incomes)
	for _, inc := range incomes {
		desc := ""
		if inc.Description != nil {
			desc = *inc.Description
		}
		entries = append(entries, UnifiedEntry{
			ID:          "INC-" + strconv.Itoa(inc.ID),
			Date:        inc.Date.Format("2006-01-02"),
			Description: desc,
			Type:        "Income",
			Category:    inc.Category,
			Credit:      inc.Amount,
			Debit:       0,
		})
	}

	c.JSON(http.StatusOK, entries)
}

func GetLedgerPDF(c *gin.Context) {
	fromStr := c.Query("from")
	toStr := c.Query("to")

	var fromDate, toDate time.Time
	var err error
	if fromStr != "" {
		fromDate, err = time.Parse(time.RFC3339, fromStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid from date format"})
			return
		}
	}
	if toStr != "" {
		toDate, err = time.Parse(time.RFC3339, toStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid to date format"})
			return
		}
	}

	type UnifiedEntry struct {
		Date        string  `json:"date"`
		Description string  `json:"description"`
		Type        string  `json:"type"`
		Category    string  `json:"category"`
		Credit      float64 `json:"credit"`
		Debit       float64 `json:"debit"`
		TimeDate    time.Time
	}
	var entries []UnifiedEntry

	var invoices []models.Invoice
	database.DB.Preload("Client").Where("status IN ?", []string{"SENT", "PAID", "OVERDUE"}).Find(&invoices)
	for _, inv := range invoices {
		credit := 0.0
		if inv.Status == "PAID" {
			if inv.ReceivedAmount != nil {
				credit = *inv.ReceivedAmount
			} else {
				credit = inv.GrandTotal
			}
		}
		
		tDate := inv.IssueDate
		if inv.Status == "PAID" && inv.PaymentDate != nil {
			tDate = *inv.PaymentDate
		}
		
		if (!fromDate.IsZero() && tDate.Before(fromDate)) || (!toDate.IsZero() && tDate.After(toDate)) {
			continue
		}

		entries = append(entries, UnifiedEntry{
			Date:        tDate.Format("2006-01-02"),
			Description: "Invoice #" + inv.InvoiceNumber + " — " + inv.Client.CompanyName,
			Type:        "Invoice",
			Category:    inv.Status,
			Credit:      credit,
			Debit:       0,
			TimeDate:    tDate,
		})
	}

	var expenses []models.Expense
	database.DB.Find(&expenses)
	for _, exp := range expenses {
		if (!fromDate.IsZero() && exp.Date.Before(fromDate)) || (!toDate.IsZero() && exp.Date.After(toDate)) {
			continue
		}
		desc := ""
		if exp.Description != nil {
			desc = *exp.Description
		}
		entries = append(entries, UnifiedEntry{
			Date:        exp.Date.Format("2006-01-02"),
			Description: desc,
			Type:        "Expense",
			Category:    exp.Category,
			Credit:      0,
			Debit:       exp.Amount,
			TimeDate:    exp.Date,
		})
	}

	var incomes []models.OtherIncome
	database.DB.Find(&incomes)
	for _, inc := range incomes {
		if (!fromDate.IsZero() && inc.Date.Before(fromDate)) || (!toDate.IsZero() && inc.Date.After(toDate)) {
			continue
		}
		desc := ""
		if inc.Description != nil {
			desc = *inc.Description
		}
		entries = append(entries, UnifiedEntry{
			Date:        inc.Date.Format("2006-01-02"),
			Description: desc,
			Type:        "Income",
			Category:    inc.Category,
			Credit:      inc.Amount,
			Debit:       0,
			TimeDate:    inc.Date,
		})
	}

	// Sort entries
	for i := 0; i < len(entries)-1; i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[i].TimeDate.After(entries[j].TimeDate) {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}

	totalCredit := 0.0
	totalDebit := 0.0
	var htmlBuilder strings.Builder

	htmlBuilder.WriteString(`
	<html>
	<head>
		<style>
			body { font-family: Arial, sans-serif; }
			table { width: 100%; border-collapse: collapse; margin-top: 20px; }
			th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
			th { background-color: #f2f2f2; }
			.credit { color: green; }
			.debit { color: red; }
			.right { text-align: right; }
		</style>
	</head>
	<body>
		<h2>Ledger Statement</h2>
		<p>Period: `)
	if !fromDate.IsZero() {
		htmlBuilder.WriteString(fromDate.Format("2006-01-02"))
	} else {
		htmlBuilder.WriteString("Beginning")
	}
	htmlBuilder.WriteString(" to ")
	if !toDate.IsZero() {
		htmlBuilder.WriteString(toDate.Format("2006-01-02"))
	} else {
		htmlBuilder.WriteString("Present")
	}
	htmlBuilder.WriteString(`</p>
		<table>
			<thead>
				<tr>
					<th>Date</th>
					<th>Description</th>
					<th>Type</th>
					<th class="right">Credit</th>
					<th class="right">Debit</th>
				</tr>
			</thead>
			<tbody>`)

	for _, e := range entries {
		totalCredit += e.Credit
		totalDebit += e.Debit
		htmlBuilder.WriteString("<tr>")
		htmlBuilder.WriteString(fmt.Sprintf("<td>%s</td>", e.Date))
		htmlBuilder.WriteString(fmt.Sprintf("<td>%s</td>", e.Description))
		htmlBuilder.WriteString(fmt.Sprintf("<td>%s</td>", e.Type))
		htmlBuilder.WriteString(fmt.Sprintf("<td class='right credit'>$%.2f</td>", e.Credit))
		htmlBuilder.WriteString(fmt.Sprintf("<td class='right debit'>$%.2f</td>", e.Debit))
		htmlBuilder.WriteString("</tr>")
	}

	htmlBuilder.WriteString(`
			</tbody>
			<tfoot>
				<tr>
					<th colspan="3" class="right">Total</th>
					<th class="right credit">$`)
	htmlBuilder.WriteString(fmt.Sprintf("%.2f", totalCredit))
	htmlBuilder.WriteString(`</th>
					<th class="right debit">$`)
	htmlBuilder.WriteString(fmt.Sprintf("%.2f", totalDebit))
	htmlBuilder.WriteString(`</th>
				</tr>
			</tfoot>
		</table>
	</body>
	</html>`)

	pdfBytes, err := services.GeneratePDF(htmlBuilder.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename=ledger.pdf")
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}
