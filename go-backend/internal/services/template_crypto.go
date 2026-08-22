package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// ICT file format constants
var ictMagic = []byte("ICT\x00")

const (
	ictVersion       byte = 0x01
	ICTTypeInvoice   byte = 0x01
	ICTTypeQuotation byte = 0x02
	ictNonceSize          = 12
	ictHeaderSize         = 4 + 1 + 1 + ictNonceSize // magic(4) + version(1) + type(1) + nonce(12) = 18
)

// Hardcoded application secret for template encryption.
// This key is embedded in the binary — only InvoiceCore can decrypt .ict files.
var appTemplateSecret = []byte("InvoiceCore::TemplateEngine::v1::AES256GCM::SecretKey2026")

func deriveKey() []byte {
	h := sha256.Sum256(appTemplateSecret)
	return h[:]
}

// EncryptTemplate encrypts raw HTML into the .ict binary format.
func EncryptTemplate(html []byte, templateType byte) ([]byte, error) {
	if templateType != ICTTypeInvoice && templateType != ICTTypeQuotation {
		return nil, errors.New("invalid template type")
	}

	key := deriveKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("cipher init failed: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("GCM init failed: %w", err)
	}

	nonce := make([]byte, ictNonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("nonce generation failed: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, html, nil)

	// Build ICT file: magic + version + type + nonce + ciphertext
	buf := make([]byte, 0, ictHeaderSize+len(ciphertext))
	buf = append(buf, ictMagic...)
	buf = append(buf, ictVersion)
	buf = append(buf, templateType)
	buf = append(buf, nonce...)
	buf = append(buf, ciphertext...)

	return buf, nil
}

// DecryptTemplate decrypts an .ict file and returns the raw HTML and template type.
func DecryptTemplate(ictData []byte) (html []byte, templateType byte, err error) {
	if len(ictData) < ictHeaderSize+16 { // min: header + GCM tag
		return nil, 0, errors.New("invalid ICT file: too short")
	}

	// Validate magic bytes
	if string(ictData[:4]) != string(ictMagic) {
		return nil, 0, errors.New("invalid ICT file: bad magic bytes")
	}

	version := ictData[4]
	if version != ictVersion {
		return nil, 0, fmt.Errorf("unsupported ICT version: %d", version)
	}

	templateType = ictData[5]
	if templateType != ICTTypeInvoice && templateType != ICTTypeQuotation {
		return nil, 0, fmt.Errorf("invalid template type in ICT: %d", templateType)
	}

	nonce := ictData[6 : 6+ictNonceSize]
	ciphertext := ictData[6+ictNonceSize:]

	key := deriveKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, 0, fmt.Errorf("cipher init failed: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, 0, fmt.Errorf("GCM init failed: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, 0, errors.New("decryption failed: invalid ICT file or corrupted data")
	}

	return plaintext, templateType, nil
}

// ICTTypeString returns "invoice" or "quotation" for the type byte.
func ICTTypeString(t byte) string {
	if t == ICTTypeInvoice {
		return "invoice"
	}
	return "quotation"
}

// ICTTypeFromString converts "invoice"/"quotation" to the type byte.
func ICTTypeFromString(s string) (byte, error) {
	switch s {
	case "invoice":
		return ICTTypeInvoice, nil
	case "quotation":
		return ICTTypeQuotation, nil
	default:
		return 0, fmt.Errorf("invalid template type: %s", s)
	}
}

// WriteICTContentDisposition returns the Content-Disposition header value for .ict download.
func WriteICTContentDisposition(name string) string {
	return fmt.Sprintf("attachment; filename=%s.ict", name)
}

// ValidateICTHeader checks if data starts with a valid ICT header without full decryption.
func ValidateICTHeader(data []byte) (version byte, templateType byte, err error) {
	if len(data) < ictHeaderSize {
		return 0, 0, errors.New("data too short for ICT header")
	}
	if string(data[:4]) != string(ictMagic) {
		return 0, 0, errors.New("not an ICT file")
	}
	return data[4], data[5], nil
}

// GetICTFileSize returns the expected minimum file size for a given HTML length.
func GetICTFileSize(htmlLen int) int {
	// header + ciphertext (same size as plaintext) + GCM tag (16 bytes)
	return ictHeaderSize + htmlLen + 16
}

// EncryptedSize returns uint32 big-endian bytes (utility for protocols).
func EncryptedSize(size int) []byte {
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, uint32(size))
	return b
}
