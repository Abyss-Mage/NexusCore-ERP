package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"
)

// GenerateRandomHex generates a cryptographically secure random hex string
func GenerateRandomHex(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateBackupCodes creates a set of one-time-use backup codes for 2FA recovery
func GenerateBackupCodes(count int) ([]string, error) {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(99999999))
		if err != nil {
			return nil, err
		}
		codes[i] = fmt.Sprintf("%08d", n.Int64())
	}
	return codes, nil
}

// GetFiscalYear returns the fiscal year string (e.g., "2425" for April 2024 - March 2025)
func GetFiscalYear(t time.Time) string {
	year := t.Year()
	month := t.Month()

	if month < 4 { // Before April = previous FY
		year--
	}

	startYear := year % 100
	endYear := (year + 1) % 100
	return fmt.Sprintf("%02d%02d", startYear, endYear)
}

// GetClientIP extracts the real client IP from the request
func GetClientIP(xForwardedFor, remoteAddr string) string {
	if xForwardedFor != "" {
		return xForwardedFor
	}
	return remoteAddr
}

// StringPtr returns a pointer to the passed string
func StringPtr(s string) *string {
	return &s
}

