package handlers

import (
	"net/http"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

// GetContextBusinessUnitID extracts the active business unit from headers or query parameters
func GetContextBusinessUnitID(c *gin.Context) string {
	if bu := c.GetHeader("X-Business-Unit-ID"); bu != "" && bu != "all" {
		return bu
	}
	if bu := c.Query("business_unit_id"); bu != "" && bu != "all" {
		return bu
	}
	return ""
}

type BusinessUnitResponse struct {
	ID                  string           `json:"id"`
	Code                string           `json:"code"`
	Name                string           `json:"name"`
	Category            string           `json:"category"`
	Description         string           `json:"description"`
	InvoicePrefix       string           `json:"invoice_prefix"`
	QuotationPrefix     string           `json:"quotation_prefix"`
	ActiveModules       models.JSONArray `json:"active_modules"`
	Currency            string           `json:"currency"`
	TaxID               *string          `json:"tax_id,omitempty"`
	Email               *string          `json:"email,omitempty"`
	Website             *string          `json:"website,omitempty"`
	Address             *models.JSONMap  `json:"address,omitempty"`
	BankDetails         *models.JSONMap  `json:"bank_details,omitempty"`
	WooCommerceSettings *models.JSONMap  `json:"woocommerce_settings,omitempty"`
	IsDefault           bool             `json:"is_default"`
	InvoiceCount        int64            `json:"invoice_count"`
	ClientCount         int64            `json:"client_count"`
	TotalRevenue        float64          `json:"total_revenue"`
}

func ListBusinessUnits(c *gin.Context) {
	var units []models.BusinessUnit
	if err := database.DB.Order("is_default desc, name asc").Find(&units).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch business units"})
		return
	}

	var responses []BusinessUnitResponse
	for _, u := range units {
		var invCount, clientCount int64
		var totalRev float64

		database.DB.Model(&models.Invoice{}).Where("business_unit_id = ?", u.ID).Count(&invCount)
		database.DB.Model(&models.Client{}).Where("business_unit_id = ?", u.ID).Count(&clientCount)
		database.DB.Model(&models.Invoice{}).
			Where("business_unit_id = ? AND status = ?", u.ID, "PAID").
			Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").
			Scan(&totalRev)

		responses = append(responses, BusinessUnitResponse{
			ID:                  u.ID,
			Code:                u.Code,
			Name:                u.Name,
			Category:            u.Category,
			Description:         u.Description,
			InvoicePrefix:       u.InvoicePrefix,
			QuotationPrefix:     u.QuotationPrefix,
			ActiveModules:       u.ActiveModules,
			Currency:            u.Currency,
			TaxID:               u.TaxID,
			Email:               u.Email,
			Website:             u.Website,
			Address:             u.Address,
			BankDetails:         u.BankDetails,
			WooCommerceSettings: u.WooCommerceSettings,
			IsDefault:           u.IsDefault,
			InvoiceCount:        invCount,
			ClientCount:         clientCount,
			TotalRevenue:        totalRev,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

func GetBusinessUnit(c *gin.Context) {
	id := c.Param("id")
	var unit models.BusinessUnit
	if err := database.DB.First(&unit, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business unit not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": unit})
}

func CreateBusinessUnit(c *gin.Context) {
	var body models.BusinessUnit
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.ID == "" {
		body.ID = body.Code
	}

	if err := database.DB.Create(&body).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Business unit already exists or database error: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": body, "message": "Business unit created successfully"})
}

func UpdateBusinessUnit(c *gin.Context) {
	id := c.Param("id")
	var unit models.BusinessUnit
	if err := database.DB.First(&unit, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business unit not found"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	delete(body, "id")
	delete(body, "created_at")

	if err := database.DB.Model(&unit).Updates(body).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": unit, "message": "Business unit updated"})
}

func DeleteBusinessUnit(c *gin.Context) {
	id := c.Param("id")
	var unit models.BusinessUnit
	if err := database.DB.First(&unit, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business unit not found"})
		return
	}

	if unit.IsDefault {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete the default business unit"})
		return
	}

	if err := database.DB.Delete(&unit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Business unit deleted"})
}

// GetBusinessDashboardStats returns company-isolated KPI statistics
func GetBusinessDashboardStats(c *gin.Context) {
	buID := c.Param("id")
	if buID == "" || buID == "current" {
		buID = GetContextBusinessUnitID(c)
	}

	query := database.DB.Model(&models.Invoice{})
	if buID != "" && buID != "all" {
		query = query.Where("business_unit_id = ?", buID)
	}

	var totalRevenue, outstanding float64
	var paidCount, pendingCount int64

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	// Revenue & Invoices
	query.Where("status = ?", "PAID").Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").Scan(&totalRevenue)
	query.Where("status = ?", "PAID").Count(&paidCount)

	database.DB.Model(&models.Invoice{}).
		Where("status IN ?"+applyBUFilter(buID), []string{"SENT", "OVERDUE", "SHARED", "PENDING", "PARTIAL"}).
		Select("COALESCE(SUM(grand_total), 0)").Scan(&outstanding)

	database.DB.Model(&models.Invoice{}).
		Where("status IN ?"+applyBUFilter(buID), []string{"SENT", "OVERDUE", "SHARED", "PENDING", "PARTIAL"}).
		Count(&pendingCount)

	// Month revenue
	var mtdRevenue float64
	database.DB.Model(&models.Invoice{}).
		Where("status = ? AND issue_date >= ?"+applyBUFilter(buID), "PAID", startOfMonth).
		Select("COALESCE(SUM(COALESCE(received_amount, grand_total)), 0)").Scan(&mtdRevenue)

	// 3D Printing jobs count if TYTGEAR or all
	var printJobsCount int64
	database.DB.Model(&models.PrintJob{}).Where("status = ?", "Printing").Count(&printJobsCount)

	// Software tasks count if Safehouse or all
	var activeTasksCount int64
	database.DB.Model(&models.SoftwareTask{}).Where("status IN ?", []string{"In Progress", "Review"}).Count(&activeTasksCount)

	c.JSON(http.StatusOK, gin.H{
		"business_unit_id": buID,
		"total_revenue":    totalRevenue,
		"mtd_revenue":      mtdRevenue,
		"outstanding":      outstanding,
		"paid_invoices":    paidCount,
		"pending_invoices": pendingCount,
		"active_prints":    printJobsCount,
		"active_tasks":     activeTasksCount,
	})
}

func applyBUFilter(buID string) string {
	if buID != "" && buID != "all" {
		return " AND business_unit_id = '" + buID + "'"
	}
	return ""
}
