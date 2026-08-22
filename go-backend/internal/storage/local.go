package storage

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

var (
	basePath       string
	isConnected    bool
)

func GetBasePath() string {
	return basePath
}

const (
	BucketInvoices = "invoices"
	BucketUploads  = "uploads"
)

// Connect initializes the local storage directory
func Connect() error {
	programData := os.Getenv("STORAGE_PATH")
	if programData == "" {
		programData = "/app/data"
	}

	basePath = filepath.Join(programData, "storage")

	for _, bucket := range []string{BucketInvoices, BucketUploads} {
		dir := filepath.Join(basePath, bucket)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("storage bucket check (%s): %w", bucket, err)
		}
		log.Printf("✅ Storage bucket ready: %s", bucket)
	}

	isConnected = true
	log.Printf("✅ Local storage connected at: %s", basePath)
	return nil
}

// IsConnected returns true if the local storage is initialized.
func IsConnected() bool {
	return isConnected
}

// PutObject uploads data to the specified bucket and returns the object key.
func PutObject(bucket, key string, reader io.Reader, size int64, contentType string) error {
	path := filepath.Join(basePath, bucket, key)
	
	// Create parent directories if they don't exist
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, reader)
	return err
}

// GetObject retrieves an object from the bucket.
func GetObject(bucket, key string) (io.ReadCloser, error) {
	path := filepath.Join(basePath, bucket, key)
	return os.Open(path)
}

// GetPresignedURL generates a temporary URL for accessing a private object.
// For local storage, we just return the local API URL.
func GetPresignedURL(bucket, key string, expiry time.Duration) (string, error) {
	// Assuming the API runs on localhost:54321
	return fmt.Sprintf("/api/storage/%s/%s", bucket, key), nil
}

// DeleteObject removes an object from the bucket.
func DeleteObject(bucket, key string) error {
	path := filepath.Join(basePath, bucket, key)
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil // Ignore if already deleted
	}
	return err
}

// ObjectExists checks if an object exists in the bucket.
func ObjectExists(bucket, key string) bool {
	path := filepath.Join(basePath, bucket, key)
	_, err := os.Stat(path)
	return err == nil
}

// GetPublicURL returns the direct URL for a public object (uploads bucket).
func GetPublicURL(bucket, key string) string {
	return fmt.Sprintf("/api/storage/%s/%s", bucket, key)
}
