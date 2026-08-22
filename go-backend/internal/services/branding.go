package services

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/anirban-guha/invoicecore/internal/storage"
)

// ImageToBase64DataURI fetches an image from MinIO or local filesystem and returns a base64 data URI.
// Supports:
//   - MinIO URLs: "http://host:9000/uploads/files/123.png"
//   - MinIO keys: "files/123.png" (looked up in uploads bucket)
//   - Local paths: "/uploads/123.png" (resolved relative to frontend/public/)
//   - Already base64: "data:image/..." (returned as-is)
func ImageToBase64DataURI(src string) string {
	if src == "" {
		return ""
	}

	// Already a data URI
	if strings.HasPrefix(src, "data:image/") {
		return src
	}

	var data []byte
	var contentType string

	// Try local storage if connected
	if storage.IsConnected() {
		// If it's a full local API URL, extract the key
		key := src
		localPrefix := "/api/storage/uploads/"
		if strings.HasPrefix(src, localPrefix) {
			key = strings.TrimPrefix(src, localPrefix)
		} else if strings.HasPrefix(src, "/uploads/") {
			// Local path convention
			key = strings.TrimPrefix(src, "/uploads/")
		}

		obj, err := storage.GetObject(storage.BucketUploads, key)
		if err == nil {
			defer obj.Close()
			data, err = io.ReadAll(obj)
			if err == nil && len(data) > 0 {
				contentType = detectContentType(key, data)
				return fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(data))
			}
		}
	}

	// Fallback: local filesystem
	if strings.HasPrefix(src, "/uploads/") || strings.HasPrefix(src, "uploads/") {
		localPath := filepath.Join("..", "frontend", "public", strings.TrimPrefix(src, "/"))
		fileData, err := os.ReadFile(localPath)
		if err == nil {
			contentType = detectContentType(localPath, fileData)
			return fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(fileData))
		}
	}

	// If nothing worked, return original src (browser may resolve it)
	return src
}

// LoadBrandingAssets loads logo, signature, and stamp from company settings as base64 data URIs.
func LoadBrandingAssets(company map[string]interface{}) map[string]string {
	assets := map[string]string{
		"logo":      "",
		"signature": "",
		"stamp":     "",
	}

	if company == nil {
		return assets
	}

	for _, key := range []string{"logo", "signature", "stamp"} {
		if val, ok := company[key]; ok {
			if src, ok := val.(string); ok && src != "" {
				assets[key] = ImageToBase64DataURI(src)
			}
		}
	}

	return assets
}

func detectContentType(path string, data []byte) string {
	// Try by extension first
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	case ".ico":
		return "image/x-icon"
	}
	// Fallback: detect from content
	return http.DetectContentType(data)
}
