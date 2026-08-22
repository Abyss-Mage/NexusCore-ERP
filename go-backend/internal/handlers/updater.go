package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type UpdateCheckResponse struct {
	UpdateAvailable bool   `json:"update_available"`
	LatestVersion   string `json:"latest_version"`
	DownloadURL     string `json:"download_url"`
	ReleaseNotes    string `json:"release_notes"`
}

const CURRENT_VERSION = "v2.0.0"

// CheckUpdate checks if a new version is available.
func CheckUpdate(c *gin.Context) {
	resp, err := http.Get("https://api.github.com/repos/SafeHouseStudios/InvoiceCore/releases/latest")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check for updates"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch release info"})
		return
	}

	var release struct {
		TagName string `json:"tag_name"`
		Body    string `json:"body"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse release info"})
		return
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersionStr := strings.TrimPrefix(CURRENT_VERSION, "v")

	// Simple string comparison for versions (assuming semantic versioning format like 2.0.0)
	updateAvailable := latestVersion > currentVersionStr

	var downloadURL string
	for _, asset := range release.Assets {
		if strings.HasSuffix(asset.Name, ".exe") {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}

	c.JSON(http.StatusOK, UpdateCheckResponse{
		UpdateAvailable: updateAvailable,
		LatestVersion:   release.TagName,
		DownloadURL:     downloadURL,
		ReleaseNotes:    release.Body,
	})
}

// PerformUpdate downloads the installer and executes it.
func PerformUpdate(c *gin.Context) {
	var req struct {
		DownloadURL string `json:"download_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	parsedURL, err := url.Parse(req.DownloadURL)
	if err != nil || parsedURL.Scheme != "https" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or non-HTTPS download URL"})
		return
	}

	allowedHosts := []string{"github.com", "api.github.com", "objects.githubusercontent.com", "safehousestudios.tech"}
	isAllowed := false
	for _, h := range allowedHosts {
		if parsedURL.Hostname() == h || strings.HasSuffix(parsedURL.Hostname(), "."+h) {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "Untrusted update source domain"})
		return
	}

	tempPath := filepath.Join(os.TempDir(), "NexusCore-Update.exe")
	
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(req.DownloadURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to download update"})
		return
	}
	defer resp.Body.Close()

	out, err := os.Create(tempPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temp file"})
		return
	}
	
	_, err = io.Copy(out, resp.Body)
	out.Close() // Close immediately before executing
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write update"})
		return
	}

	cmd := exec.Command(tempPath, "/S")
	err = cmd.Start()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to launch installer"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Update initiated, application will restart."})

	// Wait 1 second for the HTTP response to flush, then terminate so the installer can overwrite.
	go func() {
		time.Sleep(1 * time.Second)
		os.Exit(0)
	}()
}
