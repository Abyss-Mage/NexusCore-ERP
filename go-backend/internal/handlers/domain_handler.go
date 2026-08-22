package handlers

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
)

type CreateDomainRequest struct {
	ClientID         int     `json:"client_id" binding:"required"`
	DomainName       string  `json:"domain_name" binding:"required"`
	Provider         *string `json:"provider"`
	DomainExpiryDate *string `json:"domain_expiry_date"`
	AutoRenew        *bool   `json:"auto_renew"`
	RenewalPrice     float64 `json:"renewal_price"`
	Notes            *string `json:"notes"`
}

// ListDomains returns all monitored client domains
func ListDomains(c *gin.Context) {
	var domains []models.ClientDomain
	query := database.DB.Preload("Client").Order("created_at desc")

	if clientID := c.Query("client_id"); clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}

	if err := query.Find(&domains).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch domains"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": domains})
}

// CreateDomain registers a new domain to monitor
func CreateDomain(c *gin.Context) {
	var req CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	cleanDomain := strings.ToLower(strings.TrimSpace(req.DomainName))
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimRight(cleanDomain, "/")

	autoRenew := true
	if req.AutoRenew != nil {
		autoRenew = *req.AutoRenew
	}

	var expiryDate *time.Time
	if req.DomainExpiryDate != nil && *req.DomainExpiryDate != "" {
		if t, err := time.Parse("2006-01-02", *req.DomainExpiryDate); err == nil {
			expiryDate = &t
		} else if t, err := time.Parse(time.RFC3339, *req.DomainExpiryDate); err == nil {
			expiryDate = &t
		}
	}

	domain := models.ClientDomain{
		ClientID:         req.ClientID,
		DomainName:       cleanDomain,
		Provider:         req.Provider,
		DomainExpiryDate: expiryDate,
		AutoRenew:        autoRenew,
		RenewalPrice:     req.RenewalPrice,
		Notes:            req.Notes,
		Status:           "ACTIVE",
		SSLStatus:        "VALID",
	}

	if err := database.DB.Create(&domain).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register domain: " + err.Error()})
		return
	}

	// Trigger immediate background SSL & DNS check
	go checkDomainHealth(domain.ID, cleanDomain)

	c.JSON(http.StatusCreated, domain)
}

// UpdateDomain updates domain properties
func UpdateDomain(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var domain models.ClientDomain

	if err := database.DB.First(&domain, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	var req CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if req.DomainExpiryDate != nil && *req.DomainExpiryDate != "" {
		if t, err := time.Parse("2006-01-02", *req.DomainExpiryDate); err == nil {
			domain.DomainExpiryDate = &t
		} else if t, err := time.Parse(time.RFC3339, *req.DomainExpiryDate); err == nil {
			domain.DomainExpiryDate = &t
		}
	}

	domain.Provider = req.Provider
	if req.AutoRenew != nil {
		domain.AutoRenew = *req.AutoRenew
	}
	domain.RenewalPrice = req.RenewalPrice
	domain.Notes = req.Notes

	if err := database.DB.Save(&domain).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update domain"})
		return
	}

	c.JSON(http.StatusOK, domain)
}

// DeleteDomain removes a domain from tracking
func DeleteDomain(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.DB.Delete(&models.ClientDomain{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete domain"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Domain removed successfully"})
}

// CheckDomainSSL triggers an immediate SSL and DNS verification
func CheckDomainSSL(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var domain models.ClientDomain
	if err := database.DB.First(&domain, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	checkDomainHealth(domain.ID, domain.DomainName)
	database.DB.First(&domain, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Domain checked successfully",
		"domain":  domain,
	})
}

// GenerateDomainRenewalInvoice creates a draft renewal invoice for the client
func GenerateDomainRenewalInvoice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var domain models.ClientDomain
	if err := database.DB.Preload("Client").First(&domain, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Domain not found"})
		return
	}

	renewalAmount := domain.RenewalPrice
	if renewalAmount <= 0 {
		renewalAmount = 1500.0 // Default reasonable renewal fee
	}

	var bank models.BankAccount
	var bankID *int
	if err := database.DB.First(&bank).Error; err == nil {
		bankID = &bank.ID
	}

	lineItems := models.JSONArray{
		map[string]interface{}{
			"description": fmt.Sprintf("Annual Domain & SSL Certificate Renewal: %s", domain.DomainName),
			"quantity":    1,
			"rate":        renewalAmount,
			"amount":      renewalAmount,
		},
	}

	now := time.Now()
	dueDate := now.Add(15 * 24 * time.Hour)

	newInvoice := models.Invoice{
		ClientID:      domain.ClientID,
		BankAccountID: bankID,
		Status:        "DRAFT",
		IssueDate:     now,
		DueDate:       &dueDate,
		Currency:      "INR",
		Category:      utils.StringPtr("Domain & Hosting"),
		LineItems:     lineItems,
		Subtotal:      renewalAmount,
		GrandTotal:    renewalAmount,
		IsManualEntry: false,
	}

	if err := services.CreateInvoice(&newInvoice); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invoice: " + err.Error()})
		return
	}

	domain.LastInvoiceDate = &now
	database.DB.Save(&domain)

	c.JSON(http.StatusCreated, gin.H{
		"message": fmt.Sprintf("Renewal invoice %s generated", newInvoice.InvoiceNumber),
		"invoice": newInvoice,
	})
}

// Helper to perform TLS handshake and DNS lookup
func checkDomainHealth(domainID int, domainName string) {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conf := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         domainName,
	}

	now := time.Now()
	updates := map[string]interface{}{
		"last_checked_at": &now,
	}

	// 1. SSL Check
	conn, err := tls.DialWithDialer(dialer, "tcp", domainName+":443", conf)
	if err == nil {
		defer conn.Close()
		state := conn.ConnectionState()
		if len(state.PeerCertificates) > 0 {
			cert := state.PeerCertificates[0]
			updates["has_ssl"] = true
			updates["ssl_issuer"] = cert.Issuer.CommonName
			updates["ssl_expiry_date"] = cert.NotAfter

			// Check days left
			daysLeft := int(time.Until(cert.NotAfter).Hours() / 24)
			if daysLeft <= 0 {
				updates["ssl_status"] = "EXPIRED"
			} else if daysLeft <= 30 {
				updates["ssl_status"] = "EXPIRING_SOON"
			} else {
				updates["ssl_status"] = "VALID"
			}
		}
	} else {
		updates["has_ssl"] = false
		updates["ssl_status"] = "NONE"
	}

	// 2. DNS Check
	if ips, err := net.LookupHost(domainName); err == nil {
		updates["a_records"] = strings.Join(ips, ", ")
	}
	if mxRecords, err := net.LookupMX(domainName); err == nil {
		var mxStr []string
		for _, mx := range mxRecords {
			mxStr = append(mxStr, fmt.Sprintf("%s (%d)", mx.Host, mx.Pref))
		}
		updates["mx_records"] = strings.Join(mxStr, ", ")
	}
	if txtRecords, err := net.LookupTXT(domainName); err == nil {
		updates["txt_records"] = strings.Join(txtRecords, "\n")
	}

	database.DB.Model(&models.ClientDomain{}).Where("id = ?", domainID).Updates(updates)
}
