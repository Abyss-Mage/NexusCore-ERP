package database

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

type DBConfig struct {
	Type     string `json:"type"`
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func Connect() error {
	programData := os.Getenv("PROGRAMDATA")
	if programData == "" {
		programData = `C:\ProgramData`
	}

	dbDir := filepath.Join(programData, "InvoiceCore")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create db dir: %w", err)
	}

	configPath := filepath.Join(dbDir, "config.json")
	var cfg DBConfig
	cfg.Type = "sqlite" // default

	if data, err := os.ReadFile(configPath); err == nil {
		json.Unmarshal(data, &cfg)
	}

	var dialector gorm.Dialector
	
	dbUrl := os.Getenv("DATABASE_URL")

	if dbUrl != "" {
		dialector = postgres.Open(dbUrl)
		log.Printf("🔌 Connecting to PostgreSQL via DATABASE_URL")
	} else if cfg.Type == "postgres" {
		dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name)
		dialector = postgres.Open(dsn)
		log.Printf("🔌 Connecting to PostgreSQL at %s:%s", cfg.Host, cfg.Port)
	} else {
		dbPath := filepath.Join(dbDir, "invoicecore.db")
		dialector = sqlite.Open(dbPath)
		log.Printf("🔌 Connecting to SQLite database at %s", dbPath)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		DB = nil
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		DB = nil
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	DB = db
	log.Printf("✅ Database connected successfully")
	return nil

}

func IsConnected() bool {
	return DB != nil
}
