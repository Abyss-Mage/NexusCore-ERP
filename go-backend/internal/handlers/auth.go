package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
)

// AuthStatusHandler returns whether the system has been initialized (has at least one user).
func AuthStatusHandler(c *gin.Context) {
	initialized := false
	if database.IsConnected() {
		var count int64
		database.DB.Model(&models.User{}).Count(&count)
		initialized = count > 0
	}
	c.JSON(http.StatusOK, gin.H{"initialized": initialized})
}

func SetupHandler(c *gin.Context) {
	// Check if already set up
	if database.IsConnected() {
		var count int64
		database.DB.Model(&models.User{}).Count(&count)
		if count > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "System already configured"})
			return
		}
	}

	var req dto.SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate JWT secret
	jwtSecret, err := utils.GenerateRandomHex(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate secret"})
		return
	}

	// Build DATABASE_URL
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		req.DBUser, req.DBPassword, req.DBHost, req.DBPort, req.DBName)

	// Write .env file
	envContent := fmt.Sprintf("PORT=5000\nDATABASE_URL=%s\nJWT_SECRET=%s\nPUPPETEER_EXECUTABLE_PATH=%s\nENVIRONMENT=production\n",
		dbURL, jwtSecret, req.ChromePath)

	if err := os.WriteFile(".env", []byte(envContent), 0600); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write config"})
		return
	}

	// Reload config and connect
	os.Setenv("DATABASE_URL", dbURL)
	os.Setenv("JWT_SECRET", jwtSecret)

	if err := database.Connect(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection failed: " + err.Error()})
		return
	}

	if err := database.AutoMigrate(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Migration failed: " + err.Error()})
		return
	}

	// Create admin user
	user, err := services.CreateInitialAdmin(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create initial company / business unit from user setup inputs
	companyName := req.CompanyName
	if companyName == "" {
		companyName = "Primary Workspace"
	}
	companyCode := req.CompanyCode
	if companyCode == "" {
		companyCode = strings.ToUpper(strings.ReplaceAll(companyName, " ", ""))
		if len(companyCode) > 4 {
			companyCode = companyCode[:4]
		}
	}
	if companyCode == "" {
		companyCode = "ORG"
	}
	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}
	category := req.Industry
	if category == "" {
		category = "General Business"
	}
	modules := models.JSONArray{"core", "3d", "software", "ecommerce"}
	if len(req.Modules) > 0 {
		modules = models.JSONArray{}
		for _, m := range req.Modules {
			modules = append(modules, m)
		}
	}

	buID := strings.ToLower(companyCode)
	var taxIDPtr *string
	if req.TaxID != "" {
		taxIDPtr = &req.TaxID
	}

	primaryBU := models.BusinessUnit{
		ID:              buID,
		Code:            companyCode,
		Name:            companyName,
		Category:        category,
		Description:     fmt.Sprintf("Primary workspace for %s", companyName),
		InvoicePrefix:   fmt.Sprintf("%s-INV-", companyCode),
		QuotationPrefix: fmt.Sprintf("%s-QT-", companyCode),
		ActiveModules:   modules,
		Currency:        currency,
		TaxID:           taxIDPtr,
		IsDefault:       true,
	}

	// Delete any previous default and create user's customized company
	database.DB.Where("is_default = ? OR id = ?", true, buID).Delete(&models.BusinessUnit{})
	database.DB.Create(&primaryBU)

	// Create default settings
	softwareName := "NexusCore ERP"
	database.DB.Create(&models.SystemSetting{Key: "SOFTWARE_NAME", Value: &softwareName})

	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, dto.AuthResponse{
		Token: token,
		User: dto.UserResponse{
			ID:    user.ID,
			Email: user.Email,
			Role:  user.Role,
		},
	})
}

func LoginHandler(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := services.Login(req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// Log login activity
	ip := c.ClientIP()
	services.LogActivity(resp.User.ID, "LOGIN", "User logged in", nil, nil, &ip)

	c.JSON(http.StatusOK, resp)
}

func ConnectHandler(c *gin.Context) {
	var req dto.ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, err := services.ValidateServerPassword(req.ServerPassword)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "message": "Connected successfully"})
}

func ForgotPasswordHandler(c *gin.Context) {
	var req dto.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, err := services.GenerateResetToken(req.Email)
	if err != nil {
		// Don't reveal whether user exists
		c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent"})
		return
	}

	// Send email with reset token
	var smtpSetting models.SystemSetting
	if err := database.DB.Where("key = ?", "SMTP_CONFIG").First(&smtpSetting).Error; err == nil {
		smtpConfig, err := services.GetSMTPConfig(&smtpSetting)
		if err == nil {
			resetLink := fmt.Sprintf("/reset-password?token=%s", token)
			htmlBody := fmt.Sprintf("<p>Click <a href='%s'>here</a> to reset your password. This link expires in 1 hour.</p>", resetLink)
			services.SendEmail(*smtpConfig, req.Email, "Password Reset - InvoiceCore", htmlBody)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent"})
}

func ResetPasswordHandler(c *gin.Context) {
	var req dto.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := services.ResetPassword(req.Token, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successful"})
}
