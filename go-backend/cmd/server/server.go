package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"time"

	"github.com/anirban-guha/invoicecore/internal/config"
	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/handlers"
	"github.com/anirban-guha/invoicecore/internal/middleware"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/services/mqtt"
	"github.com/anirban-guha/invoicecore/internal/storage"
	"github.com/gin-gonic/gin"
)

func Start() {
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := database.Connect(); err != nil {
		log.Printf("Database connection failed: %v", err)
	}

	if database.IsConnected() {
		if err := database.AutoMigrate(); err != nil {
			log.Fatalf("Auto-migration failed: %v", err)
		}
		database.SeedIfNeeded()
		processSeedFile()
		services.SeedChartOfAccounts()
		services.StartFXBackgroundSync()
		services.StartActivityPruning()
		services.StartScheduler()
		services.StartUptimeRobot()
		
		// Start Bambu MQTT connections
		mqtt.InitBambuClients()
	}

	// Connect to MinIO object storage
	if err := storage.Connect(); err != nil {
		log.Printf("⚠ MinIO connection failed: %v (file storage disabled)", err)
	}

	if config.AppConfig.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	addr := fmt.Sprintf("0.0.0.0:%d", config.AppConfig.Port)

	// Fail fast with a helpful message if port is already in use
	if err := checkPortFree(addr); err != nil {
		log.Fatalf("❌ Port %d is already in use.\n"+
			"   Stop the existing process first, or change PORT in .env\n"+
			"   Windows: netstat -ano | findstr :%d\n"+
			"   Linux:   lsof -i :%d",
			config.AppConfig.Port, config.AppConfig.Port, config.AppConfig.Port)
	}

	r := gin.Default()
	_ = r.SetTrustedProxies(nil)

	// Serve the Next.js static export
	r.Static("/_next", "./public/_next")
	r.StaticFile("/favicon.ico", "./public/favicon.ico")
	// For Next.js static export SPA routing, we catch-all non-API routes later

	middleware.Setup(r)
	handlers.RegisterRoutes(r)

	// Catch-all route for SPA (Next.js static export)
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// Strip trailing slash if present
		if len(path) > 1 && path[len(path)-1] == '/' {
			path = path[:len(path)-1]
		}

		// Try exact match in public/ (e.g. /setup.txt, /login.html)
		exactPath := filepath.Join("public", path)
		if stat, err := os.Stat(exactPath); err == nil && !stat.IsDir() {
			c.File(exactPath)
			return
		}

		// Try path + ".html" (Next.js App Router default for /setup -> /setup.html)
		htmlPath := filepath.Join("public", path+".html")
		if stat, err := os.Stat(htmlPath); err == nil && !stat.IsDir() {
			c.File(htmlPath)
			return
		}

		// Try path + "/index.html" (Next.js trailingSlash: true behavior)
		indexPath := filepath.Join("public", path, "index.html")
		if stat, err := os.Stat(indexPath); err == nil && !stat.IsDir() {
			c.File(indexPath)
			return
		}

		// Try path + ".txt" (Next.js App Router RSC payload)
		txtPath := filepath.Join("public", path+".txt")
		if stat, err := os.Stat(txtPath); err == nil && !stat.IsDir() {
			c.File(txtPath)
			return
		}

		// Fallback to root index.html
		c.File("./public/index.html")
	})

	log.Printf("🚀 InvoiceCore server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// checkPortFree returns an error if the TCP address is already bound.
func checkPortFree(addr string) error {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	_ = ln.Close()
	// Brief pause so the OS fully releases the socket before Gin binds it
	time.Sleep(10 * time.Millisecond)
	return nil
}

func processSeedFile() {
	programData := os.Getenv("PROGRAMDATA")
	if programData == "" {
		programData = `C:\ProgramData`
	}
	seedPath := filepath.Join(programData, "InvoiceCore", "seed.json")
	if _, err := os.Stat(seedPath); os.IsNotExist(err) {
		return
	}

	data, err := os.ReadFile(seedPath)
	if err != nil {
		log.Printf("Failed to read seed file: %v", err)
		return
	}

	var seed struct {
		Type     string `json:"type"` // "local" or "postgres" or "import"
		Email    string `json:"email"`
		Password string `json:"password"`
		File     string `json:"file"`
	}
	if err := json.Unmarshal(data, &seed); err != nil {
		log.Printf("Failed to parse seed file: %v", err)
		return
	}

	// Check if already initialized (for local we seed admin. for postgres we seed if empty)
	var count int64
	database.DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		os.Remove(seedPath)
		return
	}

	if seed.Type == "local" || seed.Type == "postgres" {
		if seed.Email != "" && seed.Password != "" {
			_, err = services.CreateInitialAdmin(seed.Email, seed.Password)
			if err != nil {
				log.Printf("Failed to seed admin: %v", err)
				return
			}
		}
	} else if seed.Type == "import" && seed.File != "" {
		backupFile := filepath.Join(programData, "InvoiceCore", seed.File)
		data, err := os.ReadFile(backupFile)
		if err == nil {
			var backup map[string]json.RawMessage
			if err := json.Unmarshal(data, &backup); err == nil {
				if _, ok := backup["version"]; ok {
					if raw, ok := backup["settings"]; ok {
						var settings []models.SystemSetting
						if json.Unmarshal(raw, &settings) == nil {
							for _, s := range settings {
								database.DB.Where("key = ?", s.Key).Assign(models.SystemSetting{Value: s.Value, JSONValue: s.JSONValue}).FirstOrCreate(&s)
							}
						}
					}
					if raw, ok := backup["clients"]; ok {
						var clients []models.Client
						if json.Unmarshal(raw, &clients) == nil {
							for _, cl := range clients {
								database.DB.Where("id = ?", cl.ID).FirstOrCreate(&cl)
							}
						}
					}
					if raw, ok := backup["bank_accounts"]; ok {
						var banks []models.BankAccount
						if json.Unmarshal(raw, &banks) == nil {
							for _, b := range banks {
								database.DB.Where("id = ?", b.ID).FirstOrCreate(&b)
							}
						}
					}
					if raw, ok := backup["invoices"]; ok {
						var invoices []models.Invoice
						if json.Unmarshal(raw, &invoices) == nil {
							for _, inv := range invoices {
								database.DB.Where("id = ?", inv.ID).FirstOrCreate(&inv)
							}
						}
					}
					if raw, ok := backup["quotations"]; ok {
						var quotations []models.Quotation
						if json.Unmarshal(raw, &quotations) == nil {
							for _, q := range quotations {
								database.DB.Where("id = ?", q.ID).FirstOrCreate(&q)
							}
						}
					}
					if raw, ok := backup["expenses"]; ok {
						var expenses []models.Expense
						if json.Unmarshal(raw, &expenses) == nil {
							for _, e := range expenses {
								database.DB.Where("id = ?", e.ID).FirstOrCreate(&e)
							}
						}
					}
					if raw, ok := backup["other_income"]; ok {
						var incomes []models.OtherIncome
						if json.Unmarshal(raw, &incomes) == nil {
							for _, i := range incomes {
								database.DB.Where("id = ?", i.ID).FirstOrCreate(&i)
							}
						}
					}
					if raw, ok := backup["users"]; ok {
						var users []models.User
						if json.Unmarshal(raw, &users) == nil {
							for _, u := range users {
								database.DB.Where("id = ?", u.ID).FirstOrCreate(&u)
							}
						}
					}
				}
			}
		}
		os.Remove(backupFile)
	}

	softwareName := "InvoiceCore"
	database.DB.Create(&models.SystemSetting{Key: "SOFTWARE_NAME", Value: &softwareName})

	// Parse Industry Profile
	profilePath := filepath.Join(programData, "InvoiceCore", "profile.json")
	if profileData, err := os.ReadFile(profilePath); err == nil {
		var prof struct {
			Profile string `json:"profile"`
		}
		if json.Unmarshal(profileData, &prof) == nil && prof.Profile != "" {
			val := `["core", "` + prof.Profile + `"]` // A basic JSON array
			if prof.Profile == "all" {
				val = `["core", "3d_printing", "software_firm"]`
			}
			database.DB.Where("key = ?", "ACTIVE_MODULES").Assign(models.SystemSetting{Value: &val}).FirstOrCreate(&models.SystemSetting{Key: "ACTIVE_MODULES"})
		}
		os.Remove(profilePath)
	}

	os.Remove(seedPath)
	log.Println("✅ Successfully seeded initialization from installer")
}

func ExportBackupCLI(path string) error {
	// Create a dummy config if none exists, we just need to read what's there
	if err := database.Connect(); err != nil {
		return err
	}

	backup := map[string]interface{}{}
	var settings []models.SystemSetting
	database.DB.Find(&settings)
	backup["settings"] = settings

	var users []models.User
	database.DB.Find(&users)
	backup["users"] = users

	var clients []models.Client
	database.DB.Find(&clients)
	backup["clients"] = clients

	var invoices []models.Invoice
	database.DB.Find(&invoices)
	backup["invoices"] = invoices

	var quotations []models.Quotation
	database.DB.Find(&quotations)
	backup["quotations"] = quotations

	var expenses []models.Expense
	database.DB.Find(&expenses)
	backup["expenses"] = expenses

	var otherIncome []models.OtherIncome
	database.DB.Find(&otherIncome)
	backup["other_income"] = otherIncome

	var banks []models.BankAccount
	database.DB.Find(&banks)
	backup["bank_accounts"] = banks

	var invoiceSeqs []models.InvoiceSequence
	database.DB.Find(&invoiceSeqs)
	backup["invoice_sequences"] = invoiceSeqs

	var quotationSeqs []models.QuotationSequence
	database.DB.Find(&quotationSeqs)
	backup["quotation_sequences"] = quotationSeqs

	backup["exported_at"] = time.Now().Format(time.RFC3339)
	backup["version"] = "2.0.0"

	data, err := json.Marshal(backup)
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}
