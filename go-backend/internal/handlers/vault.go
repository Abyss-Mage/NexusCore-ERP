package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
)

type CredentialResponse struct {
	models.Credential
	DecryptedPassword string `json:"decrypted_password,omitempty"`
}

type CreateCredentialRequest struct {
	ClientID    int     `json:"client_id" binding:"required"`
	ServiceName string  `json:"service_name" binding:"required"`
	URL         *string `json:"url"`
	Username    string  `json:"username" binding:"required"`
	Password    string  `json:"password" binding:"required"`
	Notes       *string `json:"notes"`
}

// GetClientCredentials fetches credentials for a specific client (returns without passwords)
func GetClientCredentials(c *gin.Context) {
	clientId, _ := strconv.Atoi(c.Param("clientId"))
	var credentials []models.Credential
	
	if err := database.DB.Where("client_id = ?", clientId).Order("created_at desc").Find(&credentials).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credentials"})
		return
	}
	
	// We do NOT send the decrypted password in the list view for security.
	// We only send it when specifically requested or we send it masked.
	c.JSON(http.StatusOK, gin.H{"data": credentials})
}

func logVaultAccess(c *gin.Context, action string, cred *models.Credential) {
	userID, _ := getContextUserID(c)
	userEmailVal, _ := c.Get("email")
	userEmail, _ := userEmailVal.(string)

	var clientName string
	var clientID *int
	var credID *int
	var serviceName string

	if cred != nil {
		credID = &cred.ID
		serviceName = cred.ServiceName
		clientID = &cred.ClientID
		var client models.Client
		if err := database.DB.First(&client, cred.ClientID).Error; err == nil {
			clientName = client.CompanyName
		}
	}

	logEntry := models.VaultAuditLog{
		UserID:       userID,
		UserEmail:    userEmail,
		CredentialID: credID,
		ServiceName:  serviceName,
		ClientID:     clientID,
		ClientName:   clientName,
		Action:       action,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.Request.UserAgent(),
	}
	database.DB.Create(&logEntry)
}

// GetDecryptedCredential fetches a specific credential and decrypts the password
func GetDecryptedCredential(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cred models.Credential

	if err := database.DB.First(&cred, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
		return
	}

	decrypted, err := services.Decrypt(cred.EncryptedPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt password"})
		return
	}

	// Zero-Trust Audit Log
	logVaultAccess(c, "VIEW_PASSWORD", &cred)

	response := CredentialResponse{
		Credential:        cred,
		DecryptedPassword: decrypted,
	}

	c.JSON(http.StatusOK, response)
}

// CreateCredential creates a new credential
func CreateCredential(c *gin.Context) {
	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	encryptedPassword, err := services.Encrypt(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt password"})
		return
	}

	cred := models.Credential{
		ClientID:          req.ClientID,
		ServiceName:       req.ServiceName,
		URL:               req.URL,
		Username:          req.Username,
		EncryptedPassword: encryptedPassword,
		Notes:             req.Notes,
	}

	if err := database.DB.Create(&cred).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store credential"})
		return
	}

	// Audit Log
	logVaultAccess(c, "CREATE_SECRET", &cred)

	c.JSON(http.StatusCreated, cred)
}

// UpdateCredential updates a credential
func UpdateCredential(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cred models.Credential

	if err := database.DB.First(&cred, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
		return
	}

	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	encryptedPassword, err := services.Encrypt(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt password"})
		return
	}

	cred.ServiceName = req.ServiceName
	cred.URL = req.URL
	cred.Username = req.Username
	cred.EncryptedPassword = encryptedPassword
	cred.Notes = req.Notes

	if err := database.DB.Save(&cred).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update credential"})
		return
	}

	// Audit Log
	logVaultAccess(c, "UPDATE_SECRET", &cred)

	c.JSON(http.StatusOK, cred)
}

// DeleteCredential deletes a credential
func DeleteCredential(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var cred models.Credential
	if err := database.DB.First(&cred, id).Error; err == nil {
		logVaultAccess(c, "DELETE_SECRET", &cred)
	}

	if err := database.DB.Delete(&models.Credential{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete credential"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Credential deleted successfully"})
}

// GetVaultAuditLogs returns recent zero-trust access audit trail
func GetVaultAuditLogs(c *gin.Context) {
	var logs []models.VaultAuditLog
	limit := 100
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 500 {
		limit = l
	}

	query := database.DB.Order("created_at desc").Limit(limit)
	if clientID := c.Query("client_id"); clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch vault audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// GetVaultPINStatus returns whether a custom Security PIN is configured
func GetVaultPINStatus(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	_ = database.DB.First(&user, userID)

	var pinSetting models.SystemSetting
	hasPIN := false
	if err := database.DB.Where("key = ?", "VAULT_PIN").First(&pinSetting).Error; err == nil && pinSetting.Value != nil && *pinSetting.Value != "" {
		hasPIN = true
	}

	c.JSON(http.StatusOK, gin.H{
		"has_pin":            hasPIN,
		"two_factor_enabled": user.TwoFactorEnabled,
	})
}

// SetVaultPIN sets or updates the master security PIN for Vault & 2FA
func SetVaultPIN(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		PIN             string `json:"pin" binding:"required"`
		CurrentPassword string `json:"currentPassword" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !utils.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
		return
	}

	cleanPIN := strings.TrimSpace(req.PIN)
	if len(cleanPIN) != 6 || !isDigitsOnly(cleanPIN) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Security PIN must be exactly 6 digits (0-9)"})
		return
	}

	hash, err := utils.HashPassword(cleanPIN)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure PIN"})
		return
	}

	setting := models.SystemSetting{Key: "VAULT_PIN", Value: &hash}
	database.DB.Where("key = ?", "VAULT_PIN").Assign(models.SystemSetting{Value: &hash}).FirstOrCreate(&setting)
	database.DB.Model(&setting).Update("value", hash)

	ip := c.ClientIP()
	services.LogActivity(userID, "SET_VAULT_PIN", "User updated Security PIN", nil, nil, &ip)

	c.JSON(http.StatusOK, gin.H{"message": "Security PIN updated successfully"})
}

func isDigitsOnly(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}


// VerifyVaultOTP verifies the 6-digit Security PIN or Authenticator 2FA token for the Vault
func VerifyVaultOTP(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code := strings.TrimSpace(req.Token)

	// 1. Check custom Vault PIN from system_settings
	var pinSetting models.SystemSetting
	hasPIN := false
	if err := database.DB.Where("key = ?", "VAULT_PIN").First(&pinSetting).Error; err == nil && pinSetting.Value != nil && *pinSetting.Value != "" {
		hasPIN = true
		if utils.CheckPassword(code, *pinSetting.Value) || code == *pinSetting.Value {
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}
	}

	// 2. Check 2FA Authenticator code if 2FA is configured
	has2FA := user.TwoFactorSecret != nil && *user.TwoFactorSecret != ""
	if has2FA {
		if totp.Validate(code, *user.TwoFactorSecret) {
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}
	}

	if !hasPIN && !has2FA {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Security PIN or 2FA configured yet. Please set your Security PIN in My Profile."})
		return
	}

	// Return 400 Bad Request (NOT 401 Unauthorized, to prevent automatic session logout)
	c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification passcode. Use your custom Security PIN or Authenticator TOTP."})
}


