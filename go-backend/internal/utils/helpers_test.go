package utils

import (
	"testing"
	"time"
)

func TestHashAndCheckPassword(t *testing.T) {
	password, err := GenerateRandomHex(16)
	if err != nil {
		t.Fatalf("Failed to generate test password: %v", err)
	}

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if hash == password {
		t.Error("Hash should not equal plaintext password")
	}

	if !CheckPassword(password, hash) {
		t.Error("CheckPassword should return true for correct password")
	}

	wrongPassword, _ := GenerateRandomHex(16)
	if CheckPassword(wrongPassword, hash) {
		t.Error("CheckPassword should return false for incorrect password")
	}
}

func TestGenerateRandomHex(t *testing.T) {
	hex1, err := GenerateRandomHex(16)
	if err != nil {
		t.Fatalf("GenerateRandomHex failed: %v", err)
	}

	if len(hex1) != 32 { // 16 bytes = 32 hex chars
		t.Errorf("Expected 32 hex chars, got %d", len(hex1))
	}

	hex2, _ := GenerateRandomHex(16)
	if hex1 == hex2 {
		t.Error("Two random hex strings should not be equal")
	}
}

func TestGenerateBackupCodes(t *testing.T) {
	codes, err := GenerateBackupCodes(10)
	if err != nil {
		t.Fatalf("GenerateBackupCodes failed: %v", err)
	}

	if len(codes) != 10 {
		t.Errorf("Expected 10 codes, got %d", len(codes))
	}

	for _, code := range codes {
		if len(code) != 8 {
			t.Errorf("Expected 8-digit code, got %q (len=%d)", code, len(code))
		}
	}

	// Check uniqueness
	seen := make(map[string]bool)
	for _, code := range codes {
		if seen[code] {
			t.Errorf("Duplicate backup code: %s", code)
		}
		seen[code] = true
	}
}

func TestGetFiscalYear(t *testing.T) {
	tests := []struct {
		name     string
		date     time.Time
		expected string
	}{
		{"April 2024 (start of FY)", time.Date(2024, 4, 1, 0, 0, 0, 0, time.UTC), "2425"},
		{"March 2025 (end of FY)", time.Date(2025, 3, 31, 0, 0, 0, 0, time.UTC), "2425"},
		{"January 2025 (still FY 24-25)", time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC), "2425"},
		{"June 2025 (FY 25-26)", time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC), "2526"},
		{"December 2023 (FY 23-24)", time.Date(2023, 12, 25, 0, 0, 0, 0, time.UTC), "2324"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetFiscalYear(tt.date)
			if result != tt.expected {
				t.Errorf("GetFiscalYear(%v) = %q, want %q", tt.date, result, tt.expected)
			}
		})
	}
}

func TestGetClientIP(t *testing.T) {
	tests := []struct {
		xForwardedFor string
		remoteAddr    string
		expected      string
	}{
		{"1.2.3.4", "127.0.0.1", "1.2.3.4"},
		{"", "192.168.1.1", "192.168.1.1"},
		{"10.0.0.1", "192.168.1.1", "10.0.0.1"},
	}

	for _, tt := range tests {
		result := GetClientIP(tt.xForwardedFor, tt.remoteAddr)
		if result != tt.expected {
			t.Errorf("GetClientIP(%q, %q) = %q, want %q",
				tt.xForwardedFor, tt.remoteAddr, result, tt.expected)
		}
	}
}
