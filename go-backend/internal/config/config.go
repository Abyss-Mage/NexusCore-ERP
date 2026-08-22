package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                   int
	DatabaseURL            string
	JWTSecret              string
	PuppeteerExecutablePath string
	Environment            string
	RedisURL               string
}

var AppConfig Config

func Load() error {
	_ = godotenv.Load()

	port, err := strconv.Atoi(getEnv("PORT", "54321"))
	if err != nil {
		port = 54321
	}

	AppConfig = Config{
		Port:                    port,
		DatabaseURL:             getEnv("DATABASE_URL", ""),
		JWTSecret:               getEnv("JWT_SECRET", ""),
		PuppeteerExecutablePath: getEnv("PUPPETEER_EXECUTABLE_PATH", ""),
		Environment:             getEnv("ENVIRONMENT", "development"),
		RedisURL:                getEnv("REDIS_URL", ""),
	}

	if AppConfig.JWTSecret == "" {
		log.Println("[WARN] JWT_SECRET is not set — tokens will use an empty secret. Set JWT_SECRET in .env before going to production.")
	}

	return nil
}

func (c *Config) DSN() string {
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5432"),
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", ""),
		getEnv("DB_NAME", "invoice_core_db"),
	)
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
