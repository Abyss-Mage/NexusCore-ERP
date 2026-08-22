package services

import (
	"log"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/robfig/cron/v3"
)

// StartActivityPruning starts a cron job to delete activity logs older than 7 days
func StartActivityPruning() {
	c := cron.New()

	// Run daily at midnight
	c.AddFunc("0 0 * * *", pruneActivityLogs)

	// Also run immediately on startup
	go pruneActivityLogs()

	c.Start()
	log.Println("📋 Activity log pruning scheduled (7-day retention)")
}

func pruneActivityLogs() {
	if !database.IsConnected() {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -7)
	result := database.DB.Where("created_at < ?", cutoff).Delete(&models.ActivityLog{})
	if result.Error != nil {
		log.Printf("❌ Failed to prune activity logs: %v", result.Error)
		return
	}

	if result.RowsAffected > 0 {
		log.Printf("🧹 Pruned %d activity logs older than 7 days", result.RowsAffected)
	}
}

// LogActivity creates an activity log entry
func LogActivity(userID int, action, description string, entityType, entityID, ipAddress *string) {
	if !database.IsConnected() {
		return
	}

	activity := models.ActivityLog{
		UserID:      userID,
		Action:      action,
		Description: description,
		EntityType:  entityType,
		EntityID:    entityID,
		IPAddress:   ipAddress,
		Timezone:    "Asia/Kolkata",
	}

	database.DB.Create(&activity)
}
