package database

import (
	"github.com/anirban-guha/invoicecore/internal/models"
)

// AutoMigrate runs database migrations for all models
func AutoMigrate() error {
	if DB == nil {
		return nil
	}
	return models.AutoMigrateAll(DB)
}
