package handlers

import (
	"net/http"
	"strconv"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

// GetServerMonitors fetches all server monitors
func GetServerMonitors(c *gin.Context) {
	var monitors []models.ServerMonitor
	
	query := database.DB.Preload("Client").Order("created_at desc")
	
	if err := query.Find(&monitors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch monitors"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": monitors})
}

// CreateServerMonitor creates a new monitor
func CreateServerMonitor(c *gin.Context) {
	var monitor models.ServerMonitor
	if err := c.ShouldBindJSON(&monitor); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	monitor.Status = "UNKNOWN"
	if monitor.CheckIntervalMin <= 0 {
		monitor.CheckIntervalMin = 5
	}

	if err := database.DB.Create(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create monitor"})
		return
	}

	database.DB.Preload("Client").First(&monitor, monitor.ID)
	c.JSON(http.StatusCreated, monitor)
}

// UpdateServerMonitor updates an existing monitor
func UpdateServerMonitor(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var monitor models.ServerMonitor

	if err := database.DB.First(&monitor, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}

	if err := c.ShouldBindJSON(&monitor); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := database.DB.Save(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update monitor"})
		return
	}

	database.DB.Preload("Client").First(&monitor, monitor.ID)
	c.JSON(http.StatusOK, monitor)
}

// DeleteServerMonitor deletes a monitor
func DeleteServerMonitor(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	
	// Delete associated ping logs first
	database.DB.Where("monitor_id = ?", id).Delete(&models.ServerPingLog{})

	if err := database.DB.Delete(&models.ServerMonitor{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Monitor deleted successfully"})
}

// GetServerPingLogs fetches the ping history for a specific monitor
func GetServerPingLogs(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	limit := 100 // Last 100 pings for charting

	var logs []models.ServerPingLog
	
	if err := database.DB.Where("monitor_id = ?", id).Order("timestamp desc").Limit(limit).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ping logs"})
		return
	}
	
	// Reverse the logs so they are chronological for frontend charts
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}
