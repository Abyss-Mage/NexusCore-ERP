package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestLicenseValidation(t *testing.T) {
	privKeyHex := "53b58bc0ee2ae4b24e8359a4aa9d87e250dbc300b9e118d00c7cd1580af92cb3eb5327da729824c4a9411b462ca5ac9b4f2b30ca54442441a81a670f5d45d99b"
	privBytes, err := hex.DecodeString(privKeyHex)
	if err != nil {
		t.Fatalf("Failed to decode private key: %v", err)
	}
	privKey := ed25519.PrivateKey(privBytes)

	payload := LicensePayload{
		LicenseID:           "test_lic_123",
		LicenseeName:        "Safehouse Studios",
		LicenseeEmail:       "admin@safehousestudios.tech",
		Tier:                "ENTERPRISE",
		Modules:             []string{"core", "3d", "software", "vault", "woocommerce", "multi_tenant"},
		MaxBusinesses:       -1,
		MaxInvoicesPerMonth: -1,
		MaxPrinters:         -1,
		MaxDomains:          -1,
		IssuedAt:            time.Now().UTC(),
		ExpiresAt:           time.Now().UTC().AddDate(10, 0, 0),
	}

	payloadJSON, _ := json.Marshal(payload)
	sig := ed25519.Sign(privKey, payloadJSON)

	tokenData := struct {
		Payload   string `json:"p"`
		Signature string `json:"s"`
	}{
		Payload:   base64.RawURLEncoding.EncodeToString(payloadJSON),
		Signature: base64.RawURLEncoding.EncodeToString(sig),
	}
	tokenBytes, _ := json.Marshal(tokenData)
	serialCode := fmt.Sprintf("NEXUS-%s", base64.RawURLEncoding.EncodeToString(tokenBytes))

	// Test validation
	parsed, err := ValidateLicenseKey(serialCode)
	if err != nil {
		t.Fatalf("Validation failed: %v", err)
	}

	if parsed.LicenseeName != "Safehouse Studios" {
		t.Errorf("Expected licensee Safehouse Studios, got %s", parsed.LicenseeName)
	}
	if parsed.Tier != "ENTERPRISE" {
		t.Errorf("Expected tier ENTERPRISE, got %s", parsed.Tier)
	}
}
