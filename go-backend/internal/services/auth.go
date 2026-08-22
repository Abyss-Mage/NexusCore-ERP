package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/dto"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/pquerna/otp/totp"
)

// Login authenticates a user and returns a JWT token
func Login(req dto.LoginRequest) (*dto.AuthResponse, error) {
	var user models.User
	result := database.DB.Where("email = ?", req.Email).First(&user)
	if result.Error != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	if !utils.CheckPassword(req.Password, user.PasswordHash) {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Check 2FA
	if user.TwoFactorEnabled {
		if req.TOTPCode == "" {
			return nil, fmt.Errorf("2FA code required")
		}

		isValid := false

		// Check Custom PIN
		var pinSetting models.SystemSetting
		if err := database.DB.Where("key = ?", "VAULT_PIN").First(&pinSetting).Error; err == nil && pinSetting.Value != nil && *pinSetting.Value != "" {
			if utils.CheckPassword(req.TOTPCode, *pinSetting.Value) || req.TOTPCode == *pinSetting.Value {
				isValid = true
			}
		}

		// Check TOTP Authenticator
		if !isValid && user.TwoFactorSecret != nil && *user.TwoFactorSecret != "" {
			isValid = totp.Validate(req.TOTPCode, *user.TwoFactorSecret)
		}

		if !isValid {
			return nil, fmt.Errorf("invalid 2FA or Security PIN code")
		}
	}



	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &dto.AuthResponse{
		Token: token,
		User: dto.UserResponse{
			ID:               user.ID,
			Email:            user.Email,
			Role:             user.Role,
			TwoFactorEnabled: user.TwoFactorEnabled,
		},
	}, nil
}

// CreateInitialAdmin creates the first admin user during setup
func CreateInitialAdmin(email, password string) (*models.User, error) {
	hash, err := utils.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := models.User{
		Email:        email,
		PasswordHash: hash,
		Role:         "SUDO_ADMIN",
	}

	result := database.DB.Create(&user)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create admin: %w", result.Error)
	}

	return &user, nil
}

// GenerateResetToken creates a password reset token for a user
func GenerateResetToken(email string) (string, error) {
	var user models.User
	result := database.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return "", fmt.Errorf("user not found")
	}

	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)
	expiry := time.Now().Add(1 * time.Hour)

	user.ResetToken = &token
	user.ResetTokenExpiry = &expiry
	if err := database.DB.Save(&user).Error; err != nil {
		return "", fmt.Errorf("failed to save reset token: %w", err)
	}

	return token, nil
}

// ResetPassword updates a user's password using a valid reset token
func ResetPassword(token, newPassword string) error {
	var user models.User
	result := database.DB.Where("reset_token = ?", token).First(&user)
	if result.Error != nil {
		return fmt.Errorf("invalid reset token")
	}

	if user.ResetTokenExpiry != nil && user.ResetTokenExpiry.Before(time.Now()) {
		return fmt.Errorf("reset token expired")
	}

	hash, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.PasswordHash = hash
	user.ResetToken = nil
	user.ResetTokenExpiry = nil
	if err := database.DB.Save(&user).Error; err != nil {
		return fmt.Errorf("failed to save new password: %w", err)
	}

	return nil
}

// ValidateServerPassword checks the server-level password for mobile app connections
func ValidateServerPassword(password string) (string, error) {
	var setting models.SystemSetting
	result := database.DB.Where("key = ?", "SERVER_PASSWORD").First(&setting)
	if result.Error != nil || setting.Value == nil {
		return "", fmt.Errorf("server password not configured")
	}

	if !utils.CheckPassword(password, *setting.Value) {
		return "", fmt.Errorf("invalid server password")
	}

	// Generate a limited mobile session token
	token, err := utils.GenerateJWT(0, "mobile", "MOBILE_SESSION")
	if err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}

	return token, nil
}
