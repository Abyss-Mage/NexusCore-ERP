package handlers

import (
	"math"
	"net/http"
	"strconv"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

func ListClients(c *gin.Context) {
	var query dto.PaginationQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var clients []models.Client
	var total int64

	db := database.DB.Model(&models.Client{})

	if query.Search != "" {
		search := "%" + query.Search + "%"
		db = db.Where("company_name ILIKE ? OR contact_person ILIKE ? OR email ILIKE ?", search, search, search)
	}

	db.Count(&total)

	offset := (query.Page - 1) * query.Limit
	db.Order("created_at DESC").Offset(offset).Limit(query.Limit).Find(&clients)

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       clients,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	})
}

func GetClient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var client models.Client

	if err := database.DB.Preload("Invoices").Preload("Quotations").First(&client, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
		return
	}

	c.JSON(http.StatusOK, client)
}

func CreateClient(c *gin.Context) {
	var req dto.ClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var addresses *models.JSONMap
	if req.Addresses != nil {
		if addrMap, ok := req.Addresses.(map[string]interface{}); ok {
			jsonMap := models.JSONMap(addrMap)
			addresses = &jsonMap
		}
	}

	client := models.Client{
		CompanyName:   req.CompanyName,
		ContactPerson: req.ContactPerson,
		TaxID:         req.TaxID,
		CIN:           req.CIN,
		State:         req.State,
		Country:       req.Country,
		Email:         req.Email,
		Phone:         req.Phone,
		Addresses:     addresses,
	}

	if err := database.DB.Create(&client).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create client"})
		return
	}

	c.JSON(http.StatusCreated, client)
}

func UpdateClient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var client models.Client
	if err := database.DB.First(&client, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
		return
	}

	var req dto.ClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"company_name":   req.CompanyName,
		"contact_person": req.ContactPerson,
		"tax_id":         req.TaxID,
		"cin":            req.CIN,
		"state":          req.State,
		"country":        req.Country,
		"email":          req.Email,
		"phone":          req.Phone,
	}

	if req.Addresses != nil {
		if addrMap, ok := req.Addresses.(map[string]interface{}); ok {
			jsonMap := models.JSONMap(addrMap)
			updates["addresses"] = &jsonMap
		}
	}

	database.DB.Model(&client).Updates(updates)
	c.JSON(http.StatusOK, client)
}

func DeleteClient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	result := database.DB.Delete(&models.Client{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Client deleted"})
}
