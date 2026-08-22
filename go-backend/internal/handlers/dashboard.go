package handlers

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
)

// GetDashboard is the original endpoint (kept for compatibility)
func GetDashboard(c *gin.Context) {
	// Default to current financial year
	now := time.Now()
	fy := utils.GetFiscalYear(now)

	startYear := 2000 + int(fy[0]-'0')*10 + int(fy[1]-'0')
	startDate := time.Date(startYear, 4, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(startYear+1, 3, 31, 23, 59, 59, 0, time.UTC)

	if sd := c.Query("start_date"); sd != "" {
		if t, err := time.Parse("2006-01-02", sd); err == nil {
			startDate = t
		}
	}
	if ed := c.Query("end_date"); ed != "" {
		if t, err := time.Parse("2006-01-02", ed); err == nil {
			endDate = t
		}
	}

	summary, err := services.GetDashboardSummary(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dashboard data"})
		return
	}

	// Monthly breakdown
	type MonthlyData struct {
		Month    string  `json:"month"`
		Revenue  float64 `json:"revenue"`
		Expenses float64 `json:"expenses"`
		Net      float64 `json:"net"`
	}

	var monthlyStats []MonthlyData
	current := startDate
	for current.Before(endDate) {
		monthStart := time.Date(current.Year(), current.Month(), 1, 0, 0, 0, 0, time.UTC)
		monthEnd := monthStart.AddDate(0, 1, -1)
		if monthEnd.After(endDate) {
			monthEnd = endDate
		}

		var revenue, expenses float64

		database.DB.Model(&models.Invoice{}).
			Where("status = ? AND issue_date BETWEEN ? AND ?", "PAID", monthStart, monthEnd).
			Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").Scan(&revenue)

		var otherIncome float64
		database.DB.Model(&models.OtherIncome{}).
			Where("date BETWEEN ? AND ?", monthStart, monthEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&otherIncome)
		revenue += otherIncome

		database.DB.Model(&models.Expense{}).
			Where("date BETWEEN ? AND ?", monthStart, monthEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&expenses)

		monthlyStats = append(monthlyStats, MonthlyData{
			Month:    monthStart.Format("Jan 2006"),
			Revenue:  revenue,
			Expenses: expenses,
			Net:      revenue - expenses,
		})

		current = current.AddDate(0, 1, 0)
	}

	// Top unpaid invoices
	var topUnpaid []models.Invoice
	database.DB.Preload("Client").
		Where("status IN ?", []string{"SENT", "OVERDUE"}).
		Order("due_date ASC").
		Limit(5).
		Find(&topUnpaid)

	c.JSON(http.StatusOK, gin.H{
		"summary":       summary,
		"monthly_stats": monthlyStats,
		"top_unpaid":    topUnpaid,
	})
}

// GetDashboardStats handles the /dashboard/stats endpoint used by the frontend.
// Accepts ?sections=summary,monthlyStats,yearlyComparison,expenseTable,availableYears
// and optional ?from=RFC3339 &to=RFC3339 &years=2024,2023 params.
func GetDashboardStats(c *gin.Context) {
	sectionSet := map[string]bool{}
	for _, s := range strings.Split(c.Query("sections"), ",") {
		sectionSet[strings.TrimSpace(s)] = true
	}

	now := time.Now()
	from := time.Date(now.Year(), 4, 1, 0, 0, 0, 0, time.UTC)
	to := now
	if f := c.Query("from"); f != "" {
		if t, err := time.Parse(time.RFC3339, f); err == nil {
			from = t
		}
	}
	if t := c.Query("to"); t != "" {
		if t2, err := time.Parse(time.RFC3339, t); err == nil {
			to = t2
		}
	}

	type MonthlyStatEntry struct {
		Date    string  `json:"date"`
		Month   string  `json:"month"`
		Revenue float64 `json:"revenue"`
		Expense float64 `json:"expense"`
		Balance float64 `json:"balance"`
	}
	type YearlyEntry struct {
		Year    int     `json:"year"`
		Revenue float64 `json:"revenue"`
		Total   float64 `json:"total"`
		Expense float64 `json:"expense"`
		Net     float64 `json:"net"`
	}
	type Charts struct {
		MonthlyStats     []MonthlyStatEntry `json:"monthlyStats,omitempty"`
		YearlyComparison []YearlyEntry      `json:"yearlyComparison,omitempty"`
	}
	type Tables struct {
		ExpenseTable   []map[string]interface{} `json:"expenseTable"`
		ExpenseColumns []string                 `json:"expenseColumns"`
	}
	type StatsResponse struct {
		Summary        *services.DashboardSummary `json:"summary,omitempty"`
		AvailableYears []int                      `json:"availableYears,omitempty"`
		Charts         *Charts                    `json:"charts,omitempty"`
		Tables         *Tables                    `json:"tables,omitempty"`
	}

	resp := &StatsResponse{}

	if sectionSet["summary"] {
		if s, err := services.GetDashboardSummary(from, to); err == nil {
			resp.Summary = s
		}
	}

	if sectionSet["availableYears"] {
		var issueDates []time.Time
		database.DB.Model(&models.Invoice{}).Pluck("issue_date", &issueDates)
		yearSet := map[int]bool{}
		for _, d := range issueDates {
			fy := utils.GetFiscalYear(d)
			yearSet[2000+int(fy[0]-'0')*10+int(fy[1]-'0')] = true
		}
		fy := utils.GetFiscalYear(now)
		yearSet[2000+int(fy[0]-'0')*10+int(fy[1]-'0')] = true
		years := make([]int, 0, len(yearSet))
		for y := range yearSet {
			years = append(years, y)
		}
		sort.Ints(years)
		resp.AvailableYears = years
	}

	if sectionSet["monthlyStats"] {
		if resp.Charts == nil {
			resp.Charts = &Charts{}
		}
		current := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
		var runningBalance float64
		for !current.After(to) {
			mStart := current
			mEnd := mStart.AddDate(0, 1, 0).Add(-time.Second)
			if mEnd.After(to) {
				mEnd = to
			}
			var revenue, other, expenses float64
			database.DB.Model(&models.Invoice{}).
				Where("status = ? AND issue_date BETWEEN ? AND ?", "PAID", mStart, mEnd).
				Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").Scan(&revenue)
			database.DB.Model(&models.OtherIncome{}).
				Where("date BETWEEN ? AND ?", mStart, mEnd).
				Select("COALESCE(SUM(amount), 0)").Scan(&other)
			database.DB.Model(&models.Expense{}).
				Where("date BETWEEN ? AND ?", mStart, mEnd).
				Select("COALESCE(SUM(amount), 0)").Scan(&expenses)
			totalRevenue := revenue + other
			runningBalance += totalRevenue - expenses
			resp.Charts.MonthlyStats = append(resp.Charts.MonthlyStats, MonthlyStatEntry{
				Date:    mStart.Format("2006-01"),
				Month:   mStart.Format("Jan 2006"),
				Revenue: totalRevenue,
				Expense: expenses,
				Balance: runningBalance,
			})
			current = current.AddDate(0, 1, 0)
		}
	}

	if sectionSet["yearlyComparison"] {
		if resp.Charts == nil {
			resp.Charts = &Charts{}
		}
		for _, ys := range strings.Split(c.Query("years"), ",") {
			y, err := strconv.Atoi(strings.TrimSpace(ys))
			if err != nil {
				continue
			}
			start := time.Date(y, 4, 1, 0, 0, 0, 0, time.UTC)
			end := time.Date(y+1, 3, 31, 23, 59, 59, 0, time.UTC)
			var revenue, other, expenses float64
			database.DB.Model(&models.Invoice{}).
				Where("status = ? AND issue_date BETWEEN ? AND ?", "PAID", start, end).
				Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").Scan(&revenue)
			database.DB.Model(&models.OtherIncome{}).
				Where("date BETWEEN ? AND ?", start, end).
				Select("COALESCE(SUM(amount), 0)").Scan(&other)
			database.DB.Model(&models.Expense{}).
				Where("date BETWEEN ? AND ?", start, end).
				Select("COALESCE(SUM(amount), 0)").Scan(&expenses)
			totalRev := revenue + other
			resp.Charts.YearlyComparison = append(resp.Charts.YearlyComparison, YearlyEntry{
				Year: y, Revenue: totalRev, Total: totalRev, Expense: expenses,
				Net: totalRev - expenses,
			})
		}
	}

	if sectionSet["expenseTable"] {
		if resp.Tables == nil {
			resp.Tables = &Tables{}
		}
		var expenses []models.Expense
		database.DB.Where("date BETWEEN ? AND ?", from, to).Find(&expenses)

		// 1. Determine columns (categories)
		var columns []string
		catIndex := map[string]int{}
		for _, e := range expenses {
			cat := e.Category
			if cat == "" {
				cat = "Uncategorized"
			}
			if _, exists := catIndex[cat]; !exists {
				columns = append(columns, cat)
				catIndex[cat] = len(columns) - 1
			}
		}
		sort.Strings(columns)

		// 2. Determine months (rows)
		var months []string
		current := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
		for !current.After(to) {
			months = append(months, current.Format("Jan"))
			current = current.AddDate(0, 1, 0)
		}

		// 3. Aggregate data by Month -> Category
		monthData := make(map[string]map[string]float64)
		for _, m := range months {
			monthData[m] = make(map[string]float64)
		}

		for _, e := range expenses {
			cat := e.Category
			if cat == "" {
				cat = "Uncategorized"
			}
			monthName := e.Date.Format("Jan")
			if _, ok := monthData[monthName]; ok {
				monthData[monthName][cat] += e.Amount
			}
		}

		// 4. Build table rows (one per month)
		var table []map[string]interface{}
		for _, m := range months {
			row := map[string]interface{}{
				"month": m,
			}
			var total float64
			var activeCategories int
			for _, col := range columns {
				val := monthData[m][col]
				row[col] = val
				total += val
				if val > 0 {
					activeCategories++
				}
			}
			row["total"] = total
			if activeCategories > 0 {
				row["average"] = total / float64(activeCategories)
			} else {
				row["average"] = 0.0
			}
			table = append(table, row)
		}

		resp.Tables.ExpenseTable = table
		resp.Tables.ExpenseColumns = columns
	}

	c.JSON(http.StatusOK, resp)
}
