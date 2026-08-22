package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

// Master Public Key for Safehouse Studios
const MasterPublicKeyHex = "eb5327da729824c4a9411b462ca5ac9b4f2b30ca54442441a81a670f5d45d99b"

type LicensePayload struct {
	LicenseID           string    `json:"lid"`
	LicenseeName        string    `json:"name"`
	LicenseeEmail       string    `json:"email"`
	Tier                string    `json:"tier"` // COMMUNITY_FREE, PRO, ENTERPRISE, LIFETIME
	Modules             []string  `json:"mods"` // ["core", "3d", "software", "vault", "woocommerce", "multi_tenant"]
	MaxBusinesses       int       `json:"max_bu"` // -1 for unlimited, 1 for community
	MaxInvoicesPerMonth int       `json:"max_inv"` // -1 for unlimited, 15 for community
	MaxPrinters         int       `json:"max_prn"` // -1 for unlimited, 2 for community
	MaxDomains          int       `json:"max_dom"` // -1 for unlimited, 3 for community
	IssuedAt            time.Time `json:"iat"`
	ExpiresAt           time.Time `json:"exp"`
}

type LicenseStatusResponse struct {
	IsLicensed          bool           `json:"is_licensed"`
	Tier                string         `json:"tier"`
	TierLabel           string         `json:"tier_label"`
	LicenseeName        string         `json:"licensee_name"`
	LicenseeEmail       string         `json:"licensee_email"`
	MaskedSerialKey     string         `json:"masked_serial_key"`
	ExpiresAt           *time.Time     `json:"expires_at"`
	DaysRemaining       int            `json:"days_remaining"`
	IsExpired           bool           `json:"is_expired"`
	Modules             []string       `json:"modules"`
	MaxBusinesses       int            `json:"max_businesses"`
	MaxInvoicesPerMonth int            `json:"max_invoices_per_month"`
	MaxPrinters         int            `json:"max_printers"`
	MaxDomains          int            `json:"max_domains"`
	ProductInfo         ProductInfoDTO `json:"product_info"`
}

type ProductInfoDTO struct {
	ProductName string `json:"product_name"`
	Version     string `json:"version"`
	Developer   string `json:"developer"`
	Edition     string `json:"edition"`
	Tagline     string `json:"tagline"`
}

var (
	cacheMu       sync.RWMutex
	cachedLicense *LicenseStatusResponse
)

// GetCommunityDefault returns the default free open-source community tier
func GetCommunityDefault() LicenseStatusResponse {
	return LicenseStatusResponse{
		IsLicensed:          false,
		Tier:                "COMMUNITY_FREE",
		TierLabel:           "Free Community Edition",
		LicenseeName:        "Community Self-Host",
		LicenseeEmail:       "",
		MaskedSerialKey:     "",
		ExpiresAt:           nil,
		DaysRemaining:       99999,
		IsExpired:           false,
		Modules:             []string{"core", "3d", "software", "vault", "woocommerce", "multi_tenant"},
		MaxBusinesses:       2,
		MaxInvoicesPerMonth: 25,
		MaxPrinters:         2,
		MaxDomains:          3,
		ProductInfo: ProductInfoDTO{
			ProductName: "NexusCore ERP",
			Version:     "v2.5.0",
			Developer:   "Safehouse Studios",
			Edition:     "Community Open-Source",
			Tagline:     "1st AI Assisted Development Project by Safehouse Studios",
		},
	}
}

// ValidateLicenseKey cryptographically verifies the raw serial code with Ed25519
func ValidateLicenseKey(serialKey string) (*LicensePayload, error) {
	serial := strings.TrimSpace(serialKey)
	if serial == "" {
		return nil, errors.New("license serial key cannot be empty")
	}

	// Strip optional prefix NEXUS-
	if strings.HasPrefix(serial, "NEXUS-") {
		serial = strings.TrimPrefix(serial, "NEXUS-")
	}

	tokenBytes, err := base64.RawURLEncoding.DecodeString(serial)
	if err != nil {
		return nil, fmt.Errorf("invalid license format (base64 decode failed): %w", err)
	}

	var tokenData struct {
		Payload   string `json:"p"`
		Signature string `json:"s"`
	}
	if err := json.Unmarshal(tokenBytes, &tokenData); err != nil {
		return nil, fmt.Errorf("invalid token structure: %w", err)
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(tokenData.Payload)
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding: %w", err)
	}

	signature, err := base64.RawURLEncoding.DecodeString(tokenData.Signature)
	if err != nil {
		return nil, fmt.Errorf("invalid signature encoding: %w", err)
	}

	pubBytes, err := hex.DecodeString(MasterPublicKeyHex)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		return nil, errors.New("internal error: invalid embedded master public key")
	}
	pubKey := ed25519.PublicKey(pubBytes)

	// Cryptographic Ed25519 Signature Verification
	if !ed25519.Verify(pubKey, payloadJSON, signature) {
		return nil, errors.New("cryptographic signature verification failed: invalid or tampered license key")
	}

	var payload LicensePayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("corrupted license payload: %w", err)
	}

	// Check expiry
	if !payload.ExpiresAt.IsZero() && time.Now().UTC().After(payload.ExpiresAt) {
		return &payload, fmt.Errorf("license has expired on %s", payload.ExpiresAt.Format("2006-01-02"))
	}

	return &payload, nil
}

// InvalidateLicenseCache clears cached license profile
func InvalidateLicenseCache() {
	cacheMu.Lock()
	cachedLicense = nil
	cacheMu.Unlock()
}

// GetActiveLicense loads and returns the active license profile
func GetActiveLicense() LicenseStatusResponse {
	cacheMu.RLock()
	if cachedLicense != nil {
		res := *cachedLicense
		cacheMu.RUnlock()
		return res
	}
	cacheMu.RUnlock()

	var setting models.SystemSetting
	if err := database.DB.Where("key = ?", "LICENSE_KEY").First(&setting).Error; err != nil || setting.Value == nil || *setting.Value == "" {
		def := GetCommunityDefault()
		cacheMu.Lock()
		cachedLicense = &def
		cacheMu.Unlock()
		return def
	}

	serial := *setting.Value
	payload, err := ValidateLicenseKey(serial)
	if err != nil {
		def := GetCommunityDefault()
		if payload != nil {
			def.IsExpired = true
			def.LicenseeName = payload.LicenseeName
		}
		cacheMu.Lock()
		cachedLicense = &def
		cacheMu.Unlock()
		return def
	}

	daysRemaining := int(time.Until(payload.ExpiresAt).Hours() / 24)
	if daysRemaining < 0 {
		daysRemaining = 0
	}

	masked := maskSerial(serial)

	tierLabel := "Commercial Pro Edition"
	if payload.Tier == "ENTERPRISE" {
		tierLabel = "Enterprise Suite"
	} else if payload.Tier == "LIFETIME" {
		tierLabel = "Enterprise Lifetime License"
	}

	lic := LicenseStatusResponse{
		IsLicensed:          true,
		Tier:                payload.Tier,
		TierLabel:           tierLabel,
		LicenseeName:        payload.LicenseeName,
		LicenseeEmail:       payload.LicenseeEmail,
		MaskedSerialKey:     masked,
		ExpiresAt:           &payload.ExpiresAt,
		DaysRemaining:       daysRemaining,
		IsExpired:           false,
		Modules:             payload.Modules,
		MaxBusinesses:       payload.MaxBusinesses,
		MaxInvoicesPerMonth: payload.MaxInvoicesPerMonth,
		MaxPrinters:         payload.MaxPrinters,
		MaxDomains:          payload.MaxDomains,
		ProductInfo: ProductInfoDTO{
			ProductName: "NexusCore ERP",
			Version:     "v2.5.0",
			Developer:   "Safehouse Studios",
			Edition:     tierLabel,
			Tagline:     "1st AI Assisted Development Project by Safehouse Studios",
		},
	}

	cacheMu.Lock()
	cachedLicense = &lic
	cacheMu.Unlock()

	return lic
}

// ActivateLicenseKey stores and activates a validated serial key
func ActivateLicenseKey(serialKey string) (*LicenseStatusResponse, error) {
	cleanKey := strings.TrimSpace(serialKey)
	payload, err := ValidateLicenseKey(cleanKey)
	if err != nil {
		return nil, err
	}

	var setting models.SystemSetting
	err = database.DB.Where("key = ?", "LICENSE_KEY").First(&setting).Error
	if err != nil {
		setting = models.SystemSetting{
			Key:   "LICENSE_KEY",
			Value: &cleanKey,
		}
		if err := database.DB.Create(&setting).Error; err != nil {
			return nil, fmt.Errorf("failed to save license setting: %w", err)
		}
	} else {
		setting.Value = &cleanKey
		if err := database.DB.Save(&setting).Error; err != nil {
			return nil, fmt.Errorf("failed to update license setting: %w", err)
		}
	}

	InvalidateLicenseCache()
	active := GetActiveLicense()

	// Log activity
	_ = payload
	return &active, nil
}

// DeactivateLicenseKey removes the license key and returns to Community tier
func DeactivateLicenseKey() error {
	var setting models.SystemSetting
	if err := database.DB.Where("key = ?", "LICENSE_KEY").First(&setting).Error; err == nil {
		database.DB.Delete(&setting)
	}

	InvalidateLicenseCache()
	return nil
}

// HasModule checks if a specific module is licensed
func HasModule(moduleName string) bool {
	lic := GetActiveLicense()
	if !lic.IsLicensed {
		return true // Community tier includes core modules
	}
	for _, m := range lic.Modules {
		if strings.EqualFold(m, moduleName) || m == "all" || m == "*" {
			return true
		}
	}
	return false
}

func maskSerial(serial string) string {
	if len(serial) <= 12 {
		return "NEXUS-••••••••"
	}
	return fmt.Sprintf("NEXUS-••••••••••••-%s", serial[len(serial)-6:])
}
