package main

import (
	"fmt"
	"log"

	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func main() {
	dbPath := "C:\\ProgramData\\InvoiceCore\\invoicecore.db"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}

	var user models.User
	result := db.First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			fmt.Println("No users found in database.")
			// Let's create one
			hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
			newUser := models.User{
				Email:        "admin@invoicecore.com",
				PasswordHash: string(hash),
				Role:         "SUDO_ADMIN",
			}
			db.Create(&newUser)
			fmt.Println("Created new admin user:")
			fmt.Println("Email: admin@invoicecore.com")
			fmt.Println("Password: admin123")
		} else {
			log.Fatalf("Error querying users: %v", result.Error)
		}
		// Update password of first user
		hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		db.Model(&user).Update("password_hash", string(hash))
		
		fmt.Println("Reset existing user password.")
		fmt.Println("Email:", user.Email)
		fmt.Println("Password: admin123")
	}

	// Print settings
	var settings []models.SystemSetting
	db.Find(&settings)
	fmt.Println("\n--- System Settings in DB ---")
	for _, s := range settings {
		v := ""
		if s.Value != nil {
			v = *s.Value
		}
		fmt.Printf("Key: %s | Value: %s\n", s.Key, v)
	}

	// Ensure SOFTWARE_NAME is InvoiceCore
	name := "InvoiceCore"
	db.Where("key = ?", "SOFTWARE_NAME").Assign(models.SystemSetting{Value: &name}).FirstOrCreate(&models.SystemSetting{Key: "SOFTWARE_NAME", Value: &name})
	db.Model(&models.SystemSetting{}).Where("key = ?", "SOFTWARE_NAME").Update("value", name)
	fmt.Println("\nUpdated SOFTWARE_NAME to: InvoiceCore")
}

