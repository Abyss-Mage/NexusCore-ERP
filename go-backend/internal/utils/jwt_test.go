package utils

import (
	"os"
	"testing"

	"github.com/anirban-guha/invoicecore/internal/config"
)

func TestGenerateAndValidateJWT(t *testing.T) {
	// Set JWT secret for testing
	os.Setenv("JWT_SECRET", "test-secret-key-for-jwt-testing-1234567890")
	config.Load()

	token, err := GenerateJWT(1, "admin@test.com", "SUDO_ADMIN")
	if err != nil {
		t.Fatalf("GenerateJWT failed: %v", err)
	}

	if token == "" {
		t.Error("Token should not be empty")
	}

	// Validate
	claims, err := ValidateJWT(token)
	if err != nil {
		t.Fatalf("ValidateJWT failed: %v", err)
	}

	if claims.UserID != 1 {
		t.Errorf("Expected UserID 1, got %d", claims.UserID)
	}
	if claims.Email != "admin@test.com" {
		t.Errorf("Expected email admin@test.com, got %s", claims.Email)
	}
	if claims.Role != "SUDO_ADMIN" {
		t.Errorf("Expected role SUDO_ADMIN, got %s", claims.Role)
	}
}

func TestValidateJWT_InvalidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key-for-jwt-testing-1234567890")
	config.Load()

	_, err := ValidateJWT("invalid.token.string")
	if err == nil {
		t.Error("ValidateJWT should fail for invalid token")
	}
}

func TestValidateJWT_WrongSecret(t *testing.T) {
	os.Setenv("JWT_SECRET", "secret-one")
	config.Load()

	token, _ := GenerateJWT(1, "test@test.com", "ADMIN")

	// Change secret
	os.Setenv("JWT_SECRET", "secret-two")
	config.Load()

	_, err := ValidateJWT(token)
	if err == nil {
		t.Error("ValidateJWT should fail when secret changes")
	}
}
