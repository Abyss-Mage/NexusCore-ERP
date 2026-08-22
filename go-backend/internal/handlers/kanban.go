package handlers

import (
	"net/http"
	"strconv"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

// GetSoftwareTasks fetches all software tasks
func GetSoftwareTasks(c *gin.Context) {
	var tasks []models.SoftwareTask
	
	query := database.DB.Preload("Client").Order("order_index asc").Order("created_at desc")
	
	if err := query.Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

// CreateSoftwareTask creates a new software task
func CreateSoftwareTask(c *gin.Context) {
	var task models.SoftwareTask
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if task.Status == "" {
		task.Status = "BACKLOG"
	}
	if task.Priority == "" {
		task.Priority = "MEDIUM"
	}

	if err := database.DB.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	database.DB.Preload("Client").First(&task, task.ID)
	c.JSON(http.StatusCreated, task)
}

// UpdateSoftwareTask updates an existing task
func UpdateSoftwareTask(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var task models.SoftwareTask

	if err := database.DB.First(&task, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := database.DB.Save(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	database.DB.Preload("Client").First(&task, task.ID)
	c.JSON(http.StatusOK, task)
}

// DeleteSoftwareTask deletes a task
func DeleteSoftwareTask(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.DB.Delete(&models.SoftwareTask{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

// UpdateSoftwareTaskStatus handles drag-and-drop status changes
func UpdateSoftwareTaskStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	
	var req struct {
		Status     string `json:"status" binding:"required"`
		OrderIndex int    `json:"order_index"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := database.DB.Model(&models.SoftwareTask{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":      req.Status,
		"order_index": req.OrderIndex,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}
