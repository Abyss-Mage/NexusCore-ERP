package services

import (
	"log"
	"net/http"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

var uptimeTicker *time.Ticker
var stopUptimeChan = make(chan bool)

// StartUptimeRobot initializes the background worker for server monitoring
func StartUptimeRobot() {
	log.Println("Starting Uptime Robot background worker...")
	// Run every 1 minute to check which monitors are due
	uptimeTicker = time.NewTicker(1 * time.Minute)

	go func() {
		for {
			select {
			case <-uptimeTicker.C:
				checkServers()
			case <-stopUptimeChan:
				log.Println("Stopping Uptime Robot background worker...")
				return
			}
		}
	}()
	
	// Run an immediate check on startup
	go checkServers()
}

// StopUptimeRobot stops the background worker
func StopUptimeRobot() {
	if uptimeTicker != nil {
		uptimeTicker.Stop()
		stopUptimeChan <- true
	}
}

func checkServers() {
	var monitors []models.ServerMonitor
	// Fetch unpaused monitors
	database.DB.Where("is_paused = ?", false).Find(&monitors)

	now := time.Now()

	for _, m := range monitors {
		// Check if it's due based on CheckIntervalMin
		if m.LastChecked == nil || now.Sub(*m.LastChecked).Minutes() >= float64(m.CheckIntervalMin) {
			go pingServer(m, now)
		}
	}
}

func pingServer(monitor models.ServerMonitor, timestamp time.Time) {
	start := time.Now()
	
	// Create HTTP client with 10s timeout
	client := http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(monitor.URL)
	duration := time.Since(start).Milliseconds()

	isSuccess := false
	statusCode := 0
	var errMsg *string

	if err != nil {
		errStr := err.Error()
		errMsg = &errStr
	} else {
		statusCode = resp.StatusCode
		if statusCode >= 200 && statusCode < 400 {
			isSuccess = true
		} else {
			errStr := "Unexpected status code"
			errMsg = &errStr
		}
		resp.Body.Close()
	}

	// Determine new status
	newStatus := "DOWN"
	if isSuccess {
		newStatus = "UP"
	}

	// Update Monitor
	statusChanged := monitor.Status != newStatus
	monitor.Status = newStatus
	monitor.LastChecked = &timestamp
	if statusChanged {
		monitor.LastStatusChange = &timestamp
	}

	// Recalculate basic uptime % (simple approximation based on successful pings)
	var totalPings int64
	var successPings int64
	database.DB.Model(&models.ServerPingLog{}).Where("monitor_id = ?", monitor.ID).Count(&totalPings)
	database.DB.Model(&models.ServerPingLog{}).Where("monitor_id = ? AND is_success = ?", monitor.ID, true).Count(&successPings)

	if totalPings > 0 {
		monitor.UptimePercentage = float64(successPings) / float64(totalPings) * 100.0
	} else {
		if isSuccess {
			monitor.UptimePercentage = 100.0
		} else {
			monitor.UptimePercentage = 0.0
		}
	}

	database.DB.Save(&monitor)

	// Create Ping Log
	pingLog := models.ServerPingLog{
		MonitorID:      monitor.ID,
		Timestamp:      timestamp,
		StatusCode:     statusCode,
		ResponseTimeMs: int(duration),
		IsSuccess:      isSuccess,
		ErrorMessage:   errMsg,
	}
	database.DB.Create(&pingLog)
}
