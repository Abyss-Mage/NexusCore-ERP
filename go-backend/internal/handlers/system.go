package handlers

import (
	"math"
	"net/http"
	"strconv"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/middleware"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
)

// ---- Settings ----

// GetSoftwareName is accessible to all authenticated users (used by Sidebar/Navbar).
func GetSoftwareName(c *gin.Context) {
	name := "InvoiceCore"
	var setting models.SystemSetting
	if err := database.DB.Where("key = ?", "SOFTWARE_NAME").First(&setting).Error; err == nil && setting.Value != nil {
		name = *setting.Value
	}
	c.JSON(http.StatusOK, gin.H{"software_name": name})
}

// UpdateSoftwareName updates the SOFTWARE_NAME setting (admin only, registered separately).
func UpdateSoftwareName(c *gin.Context) {
	var req struct {
		SoftwareName string `json:"software_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Where("key = ?", "SOFTWARE_NAME").
		Assign(models.SystemSetting{Value: &req.SoftwareName}).
		FirstOrCreate(&models.SystemSetting{Key: "SOFTWARE_NAME", Value: &req.SoftwareName})
	c.JSON(http.StatusOK, gin.H{"software_name": req.SoftwareName})
}

// GetActiveModules returns the active modules for the current installation profile
func GetActiveModules(c *gin.Context) {
	var setting models.SystemSetting
	database.DB.Where("key = ?", "ACTIVE_MODULES").First(&setting)
	
	if setting.JSONValue != nil {
		c.JSON(http.StatusOK, gin.H{"modules": setting.JSONValue})
	} else if setting.Value != nil {
		c.JSON(http.StatusOK, gin.H{"modules": *setting.Value})
	} else {
		c.JSON(http.StatusOK, gin.H{"modules": []string{"core"}})
	}
}

func GetSettings(c *gin.Context) {
	var settings []models.SystemSetting
	database.DB.Find(&settings)
	c.JSON(http.StatusOK, settings)
}

func GetSetting(c *gin.Context) {
	key := c.Param("key")
	var settings []models.SystemSetting

	// Use Find (not First) to avoid GORM logging "record not found" for uninitialized settings
	database.DB.Where("key = ?", key).Limit(1).Find(&settings)

	if len(settings) == 0 {
		// Setting not yet saved — return empty object, frontend treats this as unconfigured
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	setting := settings[0]
	// Return json_value directly if present, otherwise the string value
	if setting.JSONValue != nil {
		c.JSON(http.StatusOK, setting.JSONValue)
		return
	}
	if setting.Value != nil {
		c.JSON(http.StatusOK, gin.H{"value": *setting.Value})
		return
	}
	c.JSON(http.StatusOK, gin.H{})
}

// PutSetting stores the entire request body as JSONB under the given key.
// Used by settings pages that PUT structured data directly (e.g. PUT /settings/company).
func PutSetting(c *gin.Context) {
	key := c.Param("key")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	jm := models.JSONMap(body)
	setting := models.SystemSetting{Key: key}
	database.DB.Where("key = ?", key).
		Assign(models.SystemSetting{JSONValue: &jm}).
		FirstOrCreate(&setting)
	database.DB.Model(&setting).Update("json_value", &jm)

	c.JSON(http.StatusOK, body)
}

func UpsertSetting(c *gin.Context) {
	var req dto.SettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var jsonValue *models.JSONMap
	if req.JSONValue != nil {
		if m, ok := req.JSONValue.(map[string]interface{}); ok {
			jm := models.JSONMap(m)
			jsonValue = &jm
		}
	}

	setting := models.SystemSetting{
		Key:       req.Key,
		Value:     req.Value,
		JSONValue: jsonValue,
	}

	database.DB.Where("key = ?", req.Key).
		Assign(models.SystemSetting{Value: req.Value, JSONValue: jsonValue}).
		FirstOrCreate(&setting)

	c.JSON(http.StatusOK, setting)
}

// ---- User Management ----

func isValidRole(r string) bool {
	switch r {
	case "SUDO_ADMIN", "ADMIN", "ACCOUNTANT", "OPERATOR", "STAFF", "VIEWER":
		return true
	}
	return false
}

func getContextUserRole(c *gin.Context) string {
	if role, exists := c.Get(middleware.ContextRole); exists {
		if rStr, ok := role.(string); ok {
			return rStr
		}
	}
	return ""
}

func ListUsers(c *gin.Context) {
	var users []models.User
	database.DB.Select("id", "email", "role", "two_factor_enabled", "created_at").Order("id asc").Find(&users)
	c.JSON(http.StatusOK, users)
}

func CreateUser(c *gin.Context) {
	var req dto.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidRole(req.Role) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Allowed roles: SUDO_ADMIN, ADMIN, ACCOUNTANT, OPERATOR, STAFF, VIEWER"})
		return
	}

	callerRole := getContextUserRole(c)
	if req.Role == "SUDO_ADMIN" && callerRole != "SUDO_ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Super Administrators can create other SUDO_ADMIN accounts"})
		return
	}

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Email:        req.Email,
		PasswordHash: hash,
		Role:         req.Role,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
		return
	}

	c.JSON(http.StatusCreated, dto.UserResponse{
		ID:    user.ID,
		Email: user.Email,
		Role:  user.Role,
	})
}

func UpdateUser(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var user models.User

	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	callerRole := getContextUserRole(c)
	if user.Role == "SUDO_ADMIN" && callerRole != "SUDO_ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Super Administrators can modify a SUDO_ADMIN user"})
		return
	}

	if body.Role != "" {
		if !isValidRole(body.Role) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Allowed roles: SUDO_ADMIN, ADMIN, ACCOUNTANT, OPERATOR, STAFF, VIEWER"})
			return
		}
		if body.Role == "SUDO_ADMIN" && callerRole != "SUDO_ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only Super Administrators can promote users to SUDO_ADMIN"})
			return
		}
	}

	updates := map[string]interface{}{}
	if body.Email != "" {
		updates["email"] = body.Email
	}
	if body.Role != "" {
		updates["role"] = body.Role
	}

	database.DB.Model(&user).Updates(updates)
	c.JSON(http.StatusOK, dto.UserResponse{
		ID:    user.ID,
		Email: user.Email,
		Role:  user.Role,
	})
}

func DeleteUser(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	// Prevent deleting self
	currentUserID, ok := getContextUserID(c)
	if !ok || currentUserID == id {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	var targetUser models.User
	if err := database.DB.First(&targetUser, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	callerRole := getContextUserRole(c)
	if targetUser.Role == "SUDO_ADMIN" {
		if callerRole != "SUDO_ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only Super Administrators can delete SUDO_ADMIN accounts"})
			return
		}

		var sudoCount int64
		database.DB.Model(&models.User{}).Where("role = ?", "SUDO_ADMIN").Count(&sudoCount)
		if sudoCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete the only remaining Super Administrator account"})
			return
		}
	}

	result := database.DB.Delete(&models.User{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted"})
}

// ---- Profile ----

func GetProfile(c *gin.Context) {
	userID, _ := getContextUserID(c)
	var user models.User

	database.DB.Select("id", "email", "role", "two_factor_enabled", "created_at").First(&user, userID)
	c.JSON(http.StatusOK, user)
}

func ChangePassword(c *gin.Context) {
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := getContextUserID(c)
	var user models.User

	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if !utils.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		return
	}

	hash, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	if err := database.DB.Model(&user).Update("password_hash", hash).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	ip := c.ClientIP()
	services.LogActivity(userID, "CHANGE_PASSWORD", "User changed password", nil, nil, &ip)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}

// ---- Activity Logs ----

func ListActivities(c *gin.Context) {
	var query dto.PaginationQuery
	_ = c.ShouldBindQuery(&query)

	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 {
		query.Limit = 100
	}

	var activities []models.ActivityLog
	var total int64

	db := database.DB.Model(&models.ActivityLog{}).Preload("User")
	db.Count(&total)

	offset := (query.Page - 1) * query.Limit
	db.Order("created_at DESC").Offset(offset).Limit(query.Limit).Find(&activities)

	c.JSON(http.StatusOK, dto.PaginatedResponse{
		Data:       activities,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
	})
}

// ---- Notifications ----

func ListNotifications(c *gin.Context) {
	userID, _ := getContextUserID(c)

	var notifications []models.Notification
	database.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&notifications)

	c.JSON(http.StatusOK, notifications)
}

func MarkNotificationRead(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	database.DB.Model(&models.Notification{}).Where("id = ?", id).Update("is_read", true)
	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

func DeleteNotification(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	database.DB.Delete(&models.Notification{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}

// ---- Utilities ----

func ListStates(c *gin.Context) {
	country := c.DefaultQuery("country", "India")
	var states []models.State
	database.DB.Where("country = ?", country).Order("name ASC").Find(&states)
	c.JSON(http.StatusOK, states)
}

func ListCountries(c *gin.Context) {
	var countries []models.Country
	database.DB.Order("name ASC").Find(&countries)
	c.JSON(http.StatusOK, countries)
}
