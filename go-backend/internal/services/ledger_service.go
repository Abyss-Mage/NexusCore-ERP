package services

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

// Standard Chart of Accounts seed
var defaultAccounts = []models.Account{
	{Code: "1010", Name: "Cash & Bank Balances", Type: models.AccountTypeAsset, Description: "Liquid funds in operating bank accounts and cash reserves", IsSystem: true},
	{Code: "1020", Name: "Accounts Receivable", Type: models.AccountTypeAsset, Description: "Outstanding client balances for issued invoices", IsSystem: true},
	{Code: "1030", Name: "Filament & Material Inventory", Type: models.AccountTypeAsset, Description: "Current stock of raw 3D printing filament and components", IsSystem: true},
	{Code: "1040", Name: "3D Printers & Hardware Equipment", Type: models.AccountTypeAsset, Description: "Machinery, Bambu Lab printers, and fixed production assets", IsSystem: true},

	{Code: "2010", Name: "Accounts Payable", Type: models.AccountTypeLiability, Description: "Outstanding liabilities to suppliers and vendors", IsSystem: true},
	{Code: "2020", Name: "GST & Sales Tax Payable", Type: models.AccountTypeLiability, Description: "Collected output tax due to government tax authorities", IsSystem: true},
	{Code: "2030", Name: "Client Retainer Advances", Type: models.AccountTypeLiability, Description: "Unearned revenue received in advance for upcoming sprints", IsSystem: true},

	{Code: "3010", Name: "Owner's Capital & Equity", Type: models.AccountTypeEquity, Description: "Initial and contributed equity by founders/owners", IsSystem: true},
	{Code: "3020", Name: "Retained Earnings", Type: models.AccountTypeEquity, Description: "Cumulative net business income retained for reinvestment", IsSystem: true},

	{Code: "4010", Name: "Software Development & Retainers", Type: models.AccountTypeRevenue, Description: "Revenue from bespoke software engineering, retainers, and IT consulting", IsSystem: true},
	{Code: "4020", Name: "3D Print Farm & Hardware Revenue", Type: models.AccountTypeRevenue, Description: "Sales from custom 3D printing, prototyping, and additive manufacturing", IsSystem: true},
	{Code: "4030", Name: "E-Commerce & Retail Sales", Type: models.AccountTypeRevenue, Description: "Store merchandise and online direct-to-consumer sales", IsSystem: true},
	{Code: "4040", Name: "Other Operating Income", Type: models.AccountTypeRevenue, Description: "Miscellaneous income, domain management fees, and interest", IsSystem: true},

	{Code: "5010", Name: "Cloud Infrastructure & Servers", Type: models.AccountTypeExpense, Description: "AWS, Oracle Cloud, VPS hosting, and server infrastructure", IsSystem: true},
	{Code: "5020", Name: "Raw Materials & Filament Purchases", Type: models.AccountTypeExpense, Description: "Spools, nozzles, resin, and physical manufacturing consumable costs", IsSystem: true},
	{Code: "5030", Name: "Software Subscriptions & SaaS", Type: models.AccountTypeExpense, Description: "GitHub, IDE licenses, communication tools, and SaaS overhead", IsSystem: true},
	{Code: "5040", Name: "Office, Rent & Utilities", Type: models.AccountTypeExpense, Description: "Electricity, workspace rent, internet, and office expenses", IsSystem: true},
	{Code: "5050", Name: "Payment Gateway & Banking Fees", Type: models.AccountTypeExpense, Description: "Stripe, Razorpay, and bank merchant transaction fees", IsSystem: true},
	{Code: "5060", Name: "Shipping, Courier & Packaging", Type: models.AccountTypeExpense, Description: "Logistics, courier dispatch, and packing boxes for physical deliveries", IsSystem: true},
}

// SeedChartOfAccounts populates standard accounts if they don't already exist
func SeedChartOfAccounts() {
	for _, acc := range defaultAccounts {
		var existing models.Account
		err := database.DB.Where("code = ?", acc.Code).First(&existing).Error
		if err != nil {
			database.DB.Create(&acc)
		}
	}
}

// PostInvoiceJournalEntry creates double-entry journal lines when an invoice is issued
func PostInvoiceJournalEntry(invoice *models.Invoice) error {
	if invoice == nil {
		return nil
	}

	entryNumber := fmt.Sprintf("JE-INV-%d", invoice.ID)

	// Clean existing entry if editing
	var existing models.JournalEntry
	if err := database.DB.Where("entry_number = ?", entryNumber).First(&existing).Error; err == nil {
		database.DB.Where("journal_entry_id = ?", existing.ID).Delete(&models.JournalLine{})
		database.DB.Delete(&existing)
	}

	// Determine Revenue Account based on category or modules
	revAccount := "4010" // Default: Software & IT
	if invoice.Category != nil {
		cat := strings.ToLower(*invoice.Category)
		if strings.Contains(cat, "3d") || strings.Contains(cat, "print") || strings.Contains(cat, "hardware") {
			revAccount = "4020"
		} else if strings.Contains(cat, "ecom") || strings.Contains(cat, "woo") || strings.Contains(cat, "retail") {
			revAccount = "4030"
		}
	}

	taxAmount := math.Max(0, invoice.GrandTotal-invoice.Subtotal)

	entry := models.JournalEntry{
		EntryNumber:    entryNumber,
		Date:           invoice.IssueDate,
		ReferenceType:  "INVOICE",
		ReferenceID:    invoice.InvoiceNumber,
		Description:    fmt.Sprintf("Invoice %s issued to Client ID %d", invoice.InvoiceNumber, invoice.ClientID),
		BusinessUnitID: invoice.BusinessUnitID,
		Currency:       invoice.Currency,
	}

	if err := database.DB.Create(&entry).Error; err != nil {
		return err
	}

	// 1. Debit Accounts Receivable (Total amount due)
	arLine := models.JournalLine{
		JournalEntryID: entry.ID,
		AccountCode:    "1020",
		Debit:          invoice.GrandTotal,
		Credit:         0.0,
		Description:    fmt.Sprintf("Receivable for %s", invoice.InvoiceNumber),
	}

	// 2. Credit Revenue (Subtotal)
	revLine := models.JournalLine{
		JournalEntryID: entry.ID,
		AccountCode:    revAccount,
		Debit:          0.0,
		Credit:         invoice.Subtotal,
		Description:    fmt.Sprintf("Revenue for %s", invoice.InvoiceNumber),
	}

	database.DB.Create(&arLine)
	database.DB.Create(&revLine)

	// 3. Credit GST/Tax Payable (if tax collected)
	if taxAmount > 0 {
		taxLine := models.JournalLine{
			JournalEntryID: entry.ID,
			AccountCode:    "2020",
			Debit:          0.0,
			Credit:         taxAmount,
			Description:    fmt.Sprintf("Output Tax for %s", invoice.InvoiceNumber),
		}
		database.DB.Create(&taxLine)
	}

	// If invoice was already marked PAID upon creation, post payment immediately
	if strings.ToUpper(invoice.Status) == "PAID" {
		PostInvoicePaymentJournalEntry(invoice)
	}

	return nil
}

// PostInvoicePaymentJournalEntry records cash receipt and reconciles Accounts Receivable
func PostInvoicePaymentJournalEntry(invoice *models.Invoice) error {
	if invoice == nil {
		return nil
	}

	entryNumber := fmt.Sprintf("JE-PAY-%d", invoice.ID)

	var existing models.JournalEntry
	if err := database.DB.Where("entry_number = ?", entryNumber).First(&existing).Error; err == nil {
		database.DB.Where("journal_entry_id = ?", existing.ID).Delete(&models.JournalLine{})
		database.DB.Delete(&existing)
	}

	payDate := time.Now()
	if invoice.PaymentDate != nil {
		payDate = *invoice.PaymentDate
	}

	payAmount := invoice.GrandTotal
	if invoice.ReceivedAmount != nil && *invoice.ReceivedAmount > 0 {
		payAmount = *invoice.ReceivedAmount
	}

	entry := models.JournalEntry{
		EntryNumber:    entryNumber,
		Date:           payDate,
		ReferenceType:  "PAYMENT",
		ReferenceID:    invoice.InvoiceNumber,
		Description:    fmt.Sprintf("Payment received for Invoice %s", invoice.InvoiceNumber),
		BusinessUnitID: invoice.BusinessUnitID,
		Currency:       invoice.Currency,
	}

	if err := database.DB.Create(&entry).Error; err != nil {
		return err
	}

	// 1. Debit Cash & Bank (Funds received)
	cashLine := models.JournalLine{
		JournalEntryID: entry.ID,
		AccountCode:    "1010",
		Debit:          payAmount,
		Credit:         0.0,
		Description:    fmt.Sprintf("Cash receipt: %s", invoice.InvoiceNumber),
	}

	// 2. Credit Accounts Receivable (Clear debt)
	arLine := models.JournalLine{
		JournalEntryID: entry.ID,
		AccountCode:    "1020",
		Debit:          0.0,
		Credit:         payAmount,
		Description:    fmt.Sprintf("Settlement: %s", invoice.InvoiceNumber),
	}

	database.DB.Create(&cashLine)
	database.DB.Create(&arLine)
	return nil
}

// PostExpenseJournalEntry records cash outflow and logs to designated expense account
func PostExpenseJournalEntry(expense *models.Expense, businessUnitID *string) error {
	if expense == nil {
		return nil
	}

	entryNumber := fmt.Sprintf("JE-EXP-%d", expense.ID)

	var existing models.JournalEntry
	if err := database.DB.Where("entry_number = ?", entryNumber).First(&existing).Error; err == nil {
		database.DB.Where("journal_entry_id = ?", existing.ID).Delete(&models.JournalLine{})
		database.DB.Delete(&existing)
	}

	// Map expense category to COA Account Code
	expAccount := "5040" // General Admin default
	cat := strings.ToLower(expense.Category)
	if strings.Contains(cat, "server") || strings.Contains(cat, "host") || strings.Contains(cat, "cloud") || strings.Contains(cat, "infra") {
		expAccount = "5010"
	} else if strings.Contains(cat, "filament") || strings.Contains(cat, "material") || strings.Contains(cat, "spool") || strings.Contains(cat, "nozzle") {
		expAccount = "5020"
	} else if strings.Contains(cat, "tool") || strings.Contains(cat, "software") || strings.Contains(cat, "saas") || strings.Contains(cat, "sub") {
		expAccount = "5030"
	} else if strings.Contains(cat, "fee") || strings.Contains(cat, "gateway") || strings.Contains(cat, "bank") || strings.Contains(cat, "stripe") || strings.Contains(cat, "razorpay") {
		expAccount = "5050"
	} else if strings.Contains(cat, "ship") || strings.Contains(cat, "courier") || strings.Contains(cat, "pack") {
		expAccount = "5060"
	}

	desc := fmt.Sprintf("Expense: %s", expense.Category)
	if expense.Description != nil && *expense.Description != "" {
		desc = *expense.Description
	}

	entry := models.JournalEntry{
		EntryNumber:    entryNumber,
		Date:           expense.Date,
		ReferenceType:  "EXPENSE",
		ReferenceID:    fmt.Sprintf("EXP-%d", expense.ID),
		Description:    desc,
		BusinessUnitID: businessUnitID,
		Currency:       "INR",
	}

	if err := database.DB.Create(&entry).Error; err != nil {
		return err
	}

	// 1. Debit Expense Account
	debitLine := models.JournalLine{
		JournalEntryID: entry.ID,
		AccountCode:    expAccount,
		Debit:          expense.Amount,
		Credit:         0.0,
		Description:    desc,
	}

	// 2. Credit Cash & Bank (Funds disbursed)
	creditLine := models.JournalLine{
		JournalEntryID: entry.ID,
		AccountCode:    "1010",
		Debit:          0.0,
		Credit:         expense.Amount,
		Description:    fmt.Sprintf("Payment for %s", expense.Category),
	}

	database.DB.Create(&debitLine)
	database.DB.Create(&creditLine)
	return nil
}

// RebuildAllJournals populates double-entry journals for all existing invoices and expenses
func RebuildAllJournals() {
	SeedChartOfAccounts()

	var invoices []models.Invoice
	database.DB.Find(&invoices)
	for _, inv := range invoices {
		_ = PostInvoiceJournalEntry(&inv)
	}

	var expenses []models.Expense
	database.DB.Find(&expenses)
	for _, exp := range expenses {
		_ = PostExpenseJournalEntry(&exp, nil)
	}
}

// ---- Financial Statement Types ----

type AccountBalance struct {
	Code        string             `json:"code"`
	Name        string             `json:"name"`
	Type        models.AccountType `json:"type"`
	DebitTotal  float64            `json:"debit_total"`
	CreditTotal float64            `json:"credit_total"`
	NetBalance  float64            `json:"net_balance"` // Normal balance sign
}

type ProfitAndLossReport struct {
	BusinessUnitID   string           `json:"business_unit_id"`
	FromDate         string           `json:"from_date"`
	ToDate           string           `json:"to_date"`
	Currency         string           `json:"currency"`
	RevenueAccounts  []AccountBalance `json:"revenue_accounts"`
	TotalRevenue     float64          `json:"total_revenue"`
	COGSAccounts     []AccountBalance `json:"cogs_accounts"`
	TotalCOGS        float64          `json:"total_cogs"`
	GrossProfit      float64          `json:"gross_profit"`
	GrossMarginPct   float64          `json:"gross_margin_pct"`
	ExpenseAccounts  []AccountBalance `json:"expense_accounts"`
	TotalExpenses    float64          `json:"total_expenses"`
	NetOperatingInc  float64          `json:"net_operating_income"`
	NetProfitMargin  float64          `json:"net_profit_margin_pct"`
}

type BalanceSheetReport struct {
	BusinessUnitID    string           `json:"business_unit_id"`
	AsOfDate          string           `json:"as_of_date"`
	Currency          string           `json:"currency"`
	CurrentAssets     []AccountBalance `json:"current_assets"`
	TotalCurrentAsset float64          `json:"total_current_assets"`
	FixedAssets       []AccountBalance `json:"fixed_assets"`
	TotalFixedAssets  float64          `json:"total_fixed_assets"`
	TotalAssets       float64          `json:"total_assets"`

	CurrentLiability  []AccountBalance `json:"current_liabilities"`
	TotalLiabilities  float64          `json:"total_liabilities"`

	EquityAccounts    []AccountBalance `json:"equity_accounts"`
	RetainedEarnings  float64          `json:"retained_earnings"`
	TotalEquity       float64          `json:"total_equity"`

	TotalLiabAndEq    float64          `json:"total_liabilities_and_equity"`
	IsBalanced        bool             `json:"is_balanced"`
}

type TrialBalanceRow struct {
	Code         string             `json:"code"`
	Name         string             `json:"name"`
	Type         models.AccountType `json:"type"`
	DebitBalance float64            `json:"debit_balance"`
	CreditBalance float64           `json:"credit_balance"`
}

type TrialBalanceReport struct {
	BusinessUnitID string            `json:"business_unit_id"`
	FromDate       string            `json:"from_date"`
	ToDate         string            `json:"to_date"`
	Currency       string            `json:"currency"`
	Rows           []TrialBalanceRow `json:"rows"`
	TotalDebit     float64           `json:"total_debit"`
	TotalCredit    float64           `json:"total_credit"`
	IsBalanced     bool              `json:"is_balanced"`
}

// GenerateProfitAndLoss computes the Income Statement
func GenerateProfitAndLoss(unitID string, from, to time.Time) ProfitAndLossReport {
	SeedChartOfAccounts()

	query := database.DB.Table("journal_lines").
		Select("accounts.code, accounts.name, accounts.type, SUM(journal_lines.debit) as debit_total, SUM(journal_lines.credit) as credit_total").
		Joins("JOIN accounts ON accounts.code = journal_lines.account_code").
		Joins("JOIN journal_entries ON journal_entries.id = journal_lines.journal_entry_id").
		Where("journal_entries.date >= ? AND journal_entries.date <= ?", from, to)

	if unitID != "" && unitID != "all" {
		query = query.Where("journal_entries.business_unit_id = ? OR journal_entries.business_unit_id IS NULL", unitID)
	}

	type Result struct {
		Code        string
		Name        string
		Type        models.AccountType
		DebitTotal  float64
		CreditTotal float64
	}

	var results []Result
	query.Group("accounts.code, accounts.name, accounts.type").Scan(&results)

	var revAccs, cogsAccs, expAccs []AccountBalance
	var totalRev, totalCOGS, totalExp float64

	for _, r := range results {
		switch r.Type {
		case models.AccountTypeRevenue:
			net := r.CreditTotal - r.DebitTotal
			if net != 0 {
				revAccs = append(revAccs, AccountBalance{
					Code: r.Code, Name: r.Name, Type: r.Type, DebitTotal: r.DebitTotal, CreditTotal: r.CreditTotal, NetBalance: net,
				})
				totalRev += net
			}
		case models.AccountTypeExpense:
			net := r.DebitTotal - r.CreditTotal
			if net != 0 {
				// Categorize COGS (5020 Filament, 5060 Shipping) vs Operating Expenses
				if r.Code == "5020" || r.Code == "5060" {
					cogsAccs = append(cogsAccs, AccountBalance{
						Code: r.Code, Name: r.Name, Type: r.Type, DebitTotal: r.DebitTotal, CreditTotal: r.CreditTotal, NetBalance: net,
					})
					totalCOGS += net
				} else {
					expAccs = append(expAccs, AccountBalance{
						Code: r.Code, Name: r.Name, Type: r.Type, DebitTotal: r.DebitTotal, CreditTotal: r.CreditTotal, NetBalance: net,
					})
					totalExp += net
				}
			}
		}
	}

	grossProfit := totalRev - totalCOGS
	grossMargin := 0.0
	if totalRev > 0 {
		grossMargin = (grossProfit / totalRev) * 100.0
	}

	netOperatingInc := grossProfit - totalExp
	netMargin := 0.0
	if totalRev > 0 {
		netMargin = (netOperatingInc / totalRev) * 100.0
	}

	return ProfitAndLossReport{
		BusinessUnitID:  unitID,
		FromDate:        from.Format("2006-01-02"),
		ToDate:          to.Format("2006-01-02"),
		Currency:        "INR",
		RevenueAccounts: revAccs,
		TotalRevenue:    totalRev,
		COGSAccounts:    cogsAccs,
		TotalCOGS:       totalCOGS,
		GrossProfit:     grossProfit,
		GrossMarginPct:  math.Round(grossMargin*100) / 100,
		ExpenseAccounts: expAccs,
		TotalExpenses:   totalExp,
		NetOperatingInc: netOperatingInc,
		NetProfitMargin: math.Round(netMargin*100) / 100,
	}
}

// GenerateBalanceSheet computes financial position as of a given date
func GenerateBalanceSheet(unitID string, asOf time.Time) BalanceSheetReport {
	SeedChartOfAccounts()

	// 1. Calculate cumulative Net Income (Retained Earnings) up to asOf date
	pl := GenerateProfitAndLoss(unitID, time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC), asOf)
	retainedEarnings := pl.NetOperatingInc

	query := database.DB.Table("journal_lines").
		Select("accounts.code, accounts.name, accounts.type, SUM(journal_lines.debit) as debit_total, SUM(journal_lines.credit) as credit_total").
		Joins("JOIN accounts ON accounts.code = journal_lines.account_code").
		Joins("JOIN journal_entries ON journal_entries.id = journal_lines.journal_entry_id").
		Where("journal_entries.date <= ?", asOf)

	if unitID != "" && unitID != "all" {
		query = query.Where("journal_entries.business_unit_id = ? OR journal_entries.business_unit_id IS NULL", unitID)
	}

	type Result struct {
		Code        string
		Name        string
		Type        models.AccountType
		DebitTotal  float64
		CreditTotal float64
	}

	var results []Result
	query.Group("accounts.code, accounts.name, accounts.type").Scan(&results)

	var currentAssets, fixedAssets, liabilities, equity []AccountBalance
	var totalCurAsset, totalFixAsset, totalLiab, totalEq float64

	for _, r := range results {
		switch r.Type {
		case models.AccountTypeAsset:
			net := r.DebitTotal - r.CreditTotal
			if r.Code == "1040" {
				fixedAssets = append(fixedAssets, AccountBalance{
					Code: r.Code, Name: r.Name, Type: r.Type, NetBalance: net,
				})
				totalFixAsset += net
			} else {
				currentAssets = append(currentAssets, AccountBalance{
					Code: r.Code, Name: r.Name, Type: r.Type, NetBalance: net,
				})
				totalCurAsset += net
			}
		case models.AccountTypeLiability:
			net := r.CreditTotal - r.DebitTotal
			liabilities = append(liabilities, AccountBalance{
				Code: r.Code, Name: r.Name, Type: r.Type, NetBalance: net,
			})
			totalLiab += net
		case models.AccountTypeEquity:
			net := r.CreditTotal - r.DebitTotal
			equity = append(equity, AccountBalance{
				Code: r.Code, Name: r.Name, Type: r.Type, NetBalance: net,
			})
			totalEq += net
		}
	}

	totalAssets := totalCurAsset + totalFixAsset
	totalEquityWithEarnings := totalEq + retainedEarnings
	totalLiabAndEq := totalLiab + totalEquityWithEarnings

	diff := math.Abs(totalAssets - totalLiabAndEq)
	isBalanced := diff < 1.0 // Within rounding margin

	return BalanceSheetReport{
		BusinessUnitID:    unitID,
		AsOfDate:          asOf.Format("2006-01-02"),
		Currency:          "INR",
		CurrentAssets:     currentAssets,
		TotalCurrentAsset: totalCurAsset,
		FixedAssets:       fixedAssets,
		TotalFixedAssets:  totalFixAsset,
		TotalAssets:       totalAssets,
		CurrentLiability:  liabilities,
		TotalLiabilities:  totalLiab,
		EquityAccounts:    equity,
		RetainedEarnings:  retainedEarnings,
		TotalEquity:       totalEquityWithEarnings,
		TotalLiabAndEq:    totalLiabAndEq,
		IsBalanced:        isBalanced,
	}
}

// GenerateTrialBalance computes Trial Balance verification
func GenerateTrialBalance(unitID string, from, to time.Time) TrialBalanceReport {
	SeedChartOfAccounts()

	query := database.DB.Table("journal_lines").
		Select("accounts.code, accounts.name, accounts.type, SUM(journal_lines.debit) as debit_total, SUM(journal_lines.credit) as credit_total").
		Joins("JOIN accounts ON accounts.code = journal_lines.account_code").
		Joins("JOIN journal_entries ON journal_entries.id = journal_lines.journal_entry_id").
		Where("journal_entries.date >= ? AND journal_entries.date <= ?", from, to)

	if unitID != "" && unitID != "all" {
		query = query.Where("journal_entries.business_unit_id = ? OR journal_entries.business_unit_id IS NULL", unitID)
	}

	type Result struct {
		Code        string
		Name        string
		Type        models.AccountType
		DebitTotal  float64
		CreditTotal float64
	}

	var results []Result
	query.Group("accounts.code, accounts.name, accounts.type").Order("accounts.code ASC").Scan(&results)

	var rows []TrialBalanceRow
	var totalDebit, totalCredit float64

	for _, r := range results {
		debitBal := 0.0
		creditBal := 0.0

		// Asset and Expense normal balance = Debit
		if r.Type == models.AccountTypeAsset || r.Type == models.AccountTypeExpense {
			if r.DebitTotal >= r.CreditTotal {
				debitBal = r.DebitTotal - r.CreditTotal
			} else {
				creditBal = r.CreditTotal - r.DebitTotal
			}
		} else {
			// Liability, Equity, Revenue normal balance = Credit
			if r.CreditTotal >= r.DebitTotal {
				creditBal = r.CreditTotal - r.DebitTotal
			} else {
				debitBal = r.DebitTotal - r.CreditTotal
			}
		}

		rows = append(rows, TrialBalanceRow{
			Code:          r.Code,
			Name:          r.Name,
			Type:          r.Type,
			DebitBalance:  debitBal,
			CreditBalance: creditBal,
		})

		totalDebit += debitBal
		totalCredit += creditBal
	}

	isBalanced := math.Abs(totalDebit-totalCredit) < 1.0

	return TrialBalanceReport{
		BusinessUnitID: unitID,
		FromDate:       from.Format("2006-01-02"),
		ToDate:         to.Format("2006-01-02"),
		Currency:       "INR",
		Rows:           rows,
		TotalDebit:     totalDebit,
		TotalCredit:    totalCredit,
		IsBalanced:     isBalanced,
	}
}
