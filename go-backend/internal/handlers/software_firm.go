package handlers

import (
	"net/http"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/gin-gonic/gin"
)

// ---- Recurring Invoices ----



// ---- Retainer Contracts ----

func ListRetainerContracts(c *gin.Context) {
	var contracts []models.RetainerContract
	database.DB.Preload("Client").Find(&contracts)
	c.JSON(http.StatusOK, contracts)
}

func CreateRetainerContract(c *gin.Context) {
	var req models.RetainerContract
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func DeleteRetainerContract(c *gin.Context) {
	id := c.Param("id")
	database.DB.Delete(&models.RetainerContract{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ---- Time Entries ----

func ListTimeEntries(c *gin.Context) {
	contractID := c.Query("contract_id")
	var entries []models.TimeEntry
	query := database.DB.Preload("Contract")
	if contractID != "" {
		query = query.Where("contract_id = ?", contractID)
	}
	query.Find(&entries)
	c.JSON(http.StatusOK, entries)
}

func CreateTimeEntry(c *gin.Context) {
	var req models.TimeEntry
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, req)
}

// ---- Client Domains ----

func ListClientDomains(c *gin.Context) {
	var domains []models.ClientDomain
	database.DB.Preload("Client").Find(&domains)
	c.JSON(http.StatusOK, domains)
}

func CreateClientDomain(c *gin.Context) {
	var req struct {
		ClientID   int    `json:"client_id" binding:"required"`
		DomainName string `json:"domain_name" binding:"required"`
		Provider   string `json:"provider"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	domain := models.ClientDomain{
		ClientID:   req.ClientID,
		DomainName: req.DomainName,
	}

	if req.Provider != "" {
		domain.Provider = &req.Provider
	}

	if err := database.DB.Create(&domain).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fetch live records synchronously so the frontend gets the data immediately
	services.UpdateDomainRecords(&domain)

	c.JSON(http.StatusCreated, domain)
}

func DeleteClientDomain(c *gin.Context) {
	id := c.Param("id")
	database.DB.Delete(&models.ClientDomain{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func VerifyClientDomain(c *gin.Context) {
	id := c.Param("id")
	var domain models.ClientDomain

	if err := database.DB.First(&domain, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	if err := services.UpdateDomainRecords(&domain); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify domain"})
		return
	}

	c.JSON(http.StatusOK, domain)
}

// ---- Proposals ----

func ListProposals(c *gin.Context) {
	var proposals []models.Proposal
	database.DB.Preload("Client").Find(&proposals)
	c.JSON(http.StatusOK, proposals)
}

func CreateProposal(c *gin.Context) {
	var req models.Proposal
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func GetProposal(c *gin.Context) {
	id := c.Param("id")
	var proposal models.Proposal
	if err := database.DB.Preload("Client").First(&proposal, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, proposal)
}
