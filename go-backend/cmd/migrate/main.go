package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/anirban-guha/invoicecore/internal/config"
	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

// MySQL → PostgreSQL data migration tool for InvoiceCore
// Usage: go run cmd/migrate/main.go <mysql_dsn>
// Example: go run cmd/migrate/main.go "root:password@tcp(localhost:3306)/invoice_core_db"

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run cmd/migrate/main.go <mysql_dsn>\n" +
			"Example: go run cmd/migrate/main.go \"root:password@tcp(localhost:3306)/invoice_core_db\"")
	}

	mysqlDSN := os.Args[1]

	// Connect to MySQL source
	log.Println("📦 Connecting to MySQL source...")
	mysqlDB, err := sql.Open("mysql", mysqlDSN+"?parseTime=true")
	if err != nil {
		log.Fatalf("MySQL connection failed: %v", err)
	}
	defer mysqlDB.Close()

	if err := mysqlDB.Ping(); err != nil {
		log.Fatalf("MySQL ping failed: %v", err)
	}
	log.Println("✅ Connected to MySQL")

	// Connect to PostgreSQL target
	log.Println("📦 Connecting to PostgreSQL target...")
	if err := config.Load(); err != nil {
		log.Fatalf("Config load failed: %v", err)
	}
	if err := database.Connect(); err != nil {
		log.Fatalf("PostgreSQL connection failed: %v", err)
	}
	if err := database.AutoMigrate(); err != nil {
		log.Fatalf("PostgreSQL migration failed: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL")

	// Migrate in dependency order
	migrateStates(mysqlDB)
	migrateCountries(mysqlDB)
	migrateSystemSettings(mysqlDB)
	migrateUsers(mysqlDB)
	migrateClients(mysqlDB)
	migrateBankAccounts(mysqlDB)
	migrateInvoiceSequences(mysqlDB)
	migrateQuotationSequences(mysqlDB)
	migrateInvoices(mysqlDB)
	migrateQuotations(mysqlDB)
	migrateExpenses(mysqlDB)
	migrateOtherIncome(mysqlDB)
	migrateActivityLogs(mysqlDB)
	migrateNotifications(mysqlDB)

	log.Println("✅ Migration complete!")
	printSummary()
}

func migrateStates(mysqlDB *sql.DB) {
	log.Println("... Migrating States")
	rows, err := mysqlDB.Query("SELECT code, name, country FROM State")
	if err != nil {
		log.Printf("  ⚠ States query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var s models.State
		if err := rows.Scan(&s.Code, &s.Name, &s.Country); err != nil {
			continue
		}
		database.DB.Where("code = ?", s.Code).FirstOrCreate(&s)
		count++
	}
	log.Printf("  ✅ %d states migrated", count)
}

func migrateCountries(mysqlDB *sql.DB) {
	log.Println("... Migrating Countries")
	rows, err := mysqlDB.Query("SELECT iso_code, name, currency, phone_code FROM Country")
	if err != nil {
		log.Printf("  ⚠ Countries query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var c models.Country
		var currency, phoneCode sql.NullString
		if err := rows.Scan(&c.ISOCode, &c.Name, &currency, &phoneCode); err != nil {
			continue
		}
		if currency.Valid {
			c.Currency = &currency.String
		}
		if phoneCode.Valid {
			c.PhoneCode = &phoneCode.String
		}
		database.DB.Where("iso_code = ?", c.ISOCode).FirstOrCreate(&c)
		count++
	}
	log.Printf("  ✅ %d countries migrated", count)
}

func migrateSystemSettings(mysqlDB *sql.DB) {
	log.Println("... Migrating SystemSettings")
	rows, err := mysqlDB.Query("SELECT `key`, value, json_value, is_locked FROM SystemSetting")
	if err != nil {
		log.Printf("  ⚠ SystemSettings query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var key string
		var value sql.NullString
		var jsonValue sql.NullString
		var isLocked bool

		if err := rows.Scan(&key, &value, &jsonValue, &isLocked); err != nil {
			continue
		}

		setting := models.SystemSetting{Key: key, IsLocked: isLocked}
		if value.Valid {
			setting.Value = &value.String
		}
		if jsonValue.Valid {
			var jm models.JSONMap
			if err := json.Unmarshal([]byte(jsonValue.String), &jm); err == nil {
				setting.JSONValue = &jm
			}
		}

		database.DB.Where("key = ?", key).FirstOrCreate(&setting)
		count++
	}
	log.Printf("  ✅ %d settings migrated", count)
}

func migrateUsers(mysqlDB *sql.DB) {
	log.Println("... Migrating Users")
	rows, err := mysqlDB.Query(`SELECT id, email, password_hash, role, two_factor_secret, 
		two_factor_enabled, backup_codes, reset_token, reset_token_expiry, created_at FROM User`)
	if err != nil {
		log.Printf("  ⚠ Users query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var u models.User
		var twoFactorSecret, resetToken sql.NullString
		var backupCodes sql.NullString
		var resetTokenExpiry sql.NullTime

		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role,
			&twoFactorSecret, &u.TwoFactorEnabled, &backupCodes,
			&resetToken, &resetTokenExpiry, &u.CreatedAt); err != nil {
			log.Printf("  ⚠ User scan error: %v", err)
			continue
		}

		if twoFactorSecret.Valid {
			u.TwoFactorSecret = &twoFactorSecret.String
		}
		if resetToken.Valid {
			u.ResetToken = &resetToken.String
		}
		if resetTokenExpiry.Valid {
			u.ResetTokenExpiry = &resetTokenExpiry.Time
		}
		if backupCodes.Valid {
			var codes models.JSONArray
			if err := json.Unmarshal([]byte(backupCodes.String), &codes); err == nil {
				u.BackupCodes = &codes
			}
		}

		database.DB.Where("email = ?", u.Email).FirstOrCreate(&u)
		count++
	}
	log.Printf("  ✅ %d users migrated", count)
}

func migrateClients(mysqlDB *sql.DB) {
	log.Println("... Migrating Clients")
	rows, err := mysqlDB.Query(`SELECT id, company_name, contact_person, tax_id, cin, 
		state_code, country, email, phone, addresses, created_at FROM Client`)
	if err != nil {
		log.Printf("  ⚠ Clients query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var c models.Client
		var contactPerson, taxID, cin, email, phone, state sql.NullString
		var addresses sql.NullString

		if err := rows.Scan(&c.ID, &c.CompanyName, &contactPerson, &taxID, &cin,
			&state, &c.Country, &email, &phone, &addresses, &c.CreatedAt); err != nil {
			continue
		}

		if contactPerson.Valid { c.ContactPerson = &contactPerson.String }
		if taxID.Valid { c.TaxID = &taxID.String }
		if cin.Valid { c.CIN = &cin.String }
		if email.Valid { c.Email = &email.String }
		if phone.Valid { c.Phone = &phone.String }
		if state.Valid { c.State = &state.String }
		if addresses.Valid {
			var jm models.JSONMap
			if err := json.Unmarshal([]byte(addresses.String), &jm); err == nil {
				c.Addresses = &jm
			}
		}

		database.DB.Where("id = ?", c.ID).FirstOrCreate(&c)
		count++
	}
	log.Printf("  ✅ %d clients migrated", count)
}

func migrateBankAccounts(mysqlDB *sql.DB) {
	log.Println("... Migrating BankAccounts")
	rows, err := mysqlDB.Query(`SELECT id, label, currency, is_default, bank_name, 
		account_holder, account_number, routing_number, swift_code, ifsc_code, 
		iban, sort_code, branch_address, upi_id, payment_method, created_at FROM BankAccount`)
	if err != nil {
		log.Printf("  ⚠ BankAccounts query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var b models.BankAccount
		var routingNumber, swiftCode, ifscCode, iban, sortCode, branchAddress, upiID, paymentMethod sql.NullString

		if err := rows.Scan(&b.ID, &b.Label, &b.Currency, &b.IsDefault, &b.BankName,
			&b.AccountHolder, &b.AccountNumber, &routingNumber, &swiftCode, &ifscCode,
			&iban, &sortCode, &branchAddress, &upiID, &paymentMethod, &b.CreatedAt); err != nil {
			continue
		}

		if routingNumber.Valid { b.RoutingNumber = &routingNumber.String }
		if swiftCode.Valid { b.SwiftCode = &swiftCode.String }
		if ifscCode.Valid { b.IFSCCode = &ifscCode.String }
		if iban.Valid { b.IBAN = &iban.String }
		if sortCode.Valid { b.SortCode = &sortCode.String }
		if branchAddress.Valid { b.BranchAddress = &branchAddress.String }
		if upiID.Valid { b.UPIID = &upiID.String }
		if paymentMethod.Valid { b.PaymentMethod = &paymentMethod.String }

		database.DB.Where("id = ?", b.ID).FirstOrCreate(&b)
		count++
	}
	log.Printf("  ✅ %d bank accounts migrated", count)
}

func migrateInvoiceSequences(mysqlDB *sql.DB) {
	log.Println("... Migrating InvoiceSequences")
	rows, err := mysqlDB.Query("SELECT id, fiscal_year, last_count FROM InvoiceSequence")
	if err != nil {
		log.Printf("  ⚠ InvoiceSequences query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var s models.InvoiceSequence
		if err := rows.Scan(&s.ID, &s.FiscalYear, &s.LastCount); err != nil {
			continue
		}
		database.DB.Where("fiscal_year = ?", s.FiscalYear).FirstOrCreate(&s)
		count++
	}
	log.Printf("  ✅ %d invoice sequences migrated", count)
}

func migrateQuotationSequences(mysqlDB *sql.DB) {
	log.Println("... Migrating QuotationSequences")
	rows, err := mysqlDB.Query("SELECT id, fiscal_year, last_count FROM QuotationSequence")
	if err != nil {
		log.Printf("  ⚠ QuotationSequences query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var s models.QuotationSequence
		if err := rows.Scan(&s.ID, &s.FiscalYear, &s.LastCount); err != nil {
			continue
		}
		database.DB.Where("fiscal_year = ?", s.FiscalYear).FirstOrCreate(&s)
		count++
	}
	log.Printf("  ✅ %d quotation sequences migrated", count)
}

func migrateInvoices(mysqlDB *sql.DB) {
	log.Println("... Migrating Invoices")
	rows, err := mysqlDB.Query(`SELECT id, invoice_number, client_id, bank_account_id, status, 
		issue_date, due_date, payment_date, currency, received_amount, line_items, tax_summary, 
		subtotal, grand_total, remarks, is_manual_entry, created_at, updated_at FROM Invoice`)
	if err != nil {
		log.Printf("  ⚠ Invoices query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var inv models.Invoice
		var bankAccountID sql.NullInt64
		var dueDate, paymentDate sql.NullTime
		var receivedAmount sql.NullFloat64
		var lineItemsStr, taxSummaryStr string
		var remarks sql.NullString

		if err := rows.Scan(&inv.ID, &inv.InvoiceNumber, &inv.ClientID, &bankAccountID,
			&inv.Status, &inv.IssueDate, &dueDate, &paymentDate, &inv.Currency,
			&receivedAmount, &lineItemsStr, &taxSummaryStr, &inv.Subtotal,
			&inv.GrandTotal, &remarks, &inv.IsManualEntry, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
			log.Printf("  ⚠ Invoice scan error: %v", err)
			continue
		}

		if bankAccountID.Valid { id := int(bankAccountID.Int64); inv.BankAccountID = &id }
		if dueDate.Valid { inv.DueDate = &dueDate.Time }
		if paymentDate.Valid { inv.PaymentDate = &paymentDate.Time }
		if receivedAmount.Valid { inv.ReceivedAmount = &receivedAmount.Float64 }
		if remarks.Valid { inv.Remarks = &remarks.String }

		json.Unmarshal([]byte(lineItemsStr), &inv.LineItems)
		json.Unmarshal([]byte(taxSummaryStr), &inv.TaxSummary)

		database.DB.Where("invoice_number = ?", inv.InvoiceNumber).FirstOrCreate(&inv)
		count++
	}
	log.Printf("  ✅ %d invoices migrated", count)
}

func migrateQuotations(mysqlDB *sql.DB) {
	log.Println("... Migrating Quotations")
	rows, err := mysqlDB.Query(`SELECT id, quotation_number, client_id, bank_account_id, 
		issue_date, expiry_date, status, line_items, services_offered, contract_terms, 
		remarks, subtotal, grand_total, currency, is_manual_entry, created_at, updated_at FROM Quotation`)
	if err != nil {
		log.Printf("  ⚠ Quotations query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var q models.Quotation
		var bankAccountID sql.NullInt64
		var expiryDate sql.NullTime
		var lineItemsStr string
		var servicesOffered, contractTerms, remarks sql.NullString

		if err := rows.Scan(&q.ID, &q.QuotationNumber, &q.ClientID, &bankAccountID,
			&q.IssueDate, &expiryDate, &q.Status, &lineItemsStr, &servicesOffered,
			&contractTerms, &remarks, &q.Subtotal, &q.GrandTotal, &q.Currency,
			&q.IsManualEntry, &q.CreatedAt, &q.UpdatedAt); err != nil {
			continue
		}

		if bankAccountID.Valid { id := int(bankAccountID.Int64); q.BankAccountID = &id }
		if expiryDate.Valid { q.ExpiryDate = &expiryDate.Time }
		if servicesOffered.Valid { q.ServicesOffered = &servicesOffered.String }
		if contractTerms.Valid { q.ContractTerms = &contractTerms.String }
		if remarks.Valid { q.Remarks = &remarks.String }

		json.Unmarshal([]byte(lineItemsStr), &q.LineItems)

		database.DB.Where("quotation_number = ?", q.QuotationNumber).FirstOrCreate(&q)
		count++
	}
	log.Printf("  ✅ %d quotations migrated", count)
}

func migrateExpenses(mysqlDB *sql.DB) {
	log.Println("... Migrating Expenses")
	rows, err := mysqlDB.Query("SELECT id, category, amount, date, description, created_at FROM Expense")
	if err != nil {
		log.Printf("  ⚠ Expenses query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var e models.Expense
		var description sql.NullString

		if err := rows.Scan(&e.ID, &e.Category, &e.Amount, &e.Date, &description, &e.CreatedAt); err != nil {
			continue
		}
		if description.Valid { e.Description = &description.String }

		database.DB.Where("id = ?", e.ID).FirstOrCreate(&e)
		count++
	}
	log.Printf("  ✅ %d expenses migrated", count)
}

func migrateOtherIncome(mysqlDB *sql.DB) {
	log.Println("... Migrating OtherIncome")
	rows, err := mysqlDB.Query("SELECT id, category, amount, date, description, created_at FROM OtherIncome")
	if err != nil {
		log.Printf("  ⚠ OtherIncome query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var o models.OtherIncome
		var description sql.NullString

		if err := rows.Scan(&o.ID, &o.Category, &o.Amount, &o.Date, &description, &o.CreatedAt); err != nil {
			continue
		}
		if description.Valid { o.Description = &description.String }

		database.DB.Where("id = ?", o.ID).FirstOrCreate(&o)
		count++
	}
	log.Printf("  ✅ %d other income records migrated", count)
}

func migrateActivityLogs(mysqlDB *sql.DB) {
	log.Println("... Migrating ActivityLogs")
	rows, err := mysqlDB.Query(`SELECT id, user_id, action, description, entity_type, 
		entity_id, ip_address, created_at, timezone FROM ActivityLog`)
	if err != nil {
		log.Printf("  ⚠ ActivityLogs query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var a models.ActivityLog
		var entityType, entityID, ipAddress sql.NullString

		if err := rows.Scan(&a.ID, &a.UserID, &a.Action, &a.Description,
			&entityType, &entityID, &ipAddress, &a.CreatedAt, &a.Timezone); err != nil {
			continue
		}

		if entityType.Valid { a.EntityType = &entityType.String }
		if entityID.Valid { a.EntityID = &entityID.String }
		if ipAddress.Valid { a.IPAddress = &ipAddress.String }

		database.DB.Where("id = ?", a.ID).FirstOrCreate(&a)
		count++
	}
	log.Printf("  ✅ %d activity logs migrated", count)
}

func migrateNotifications(mysqlDB *sql.DB) {
	log.Println("... Migrating Notifications")
	rows, err := mysqlDB.Query(`SELECT id, user_id, title, message, type, is_read, 
		link, created_at FROM Notification`)
	if err != nil {
		log.Printf("  ⚠ Notifications query failed: %v", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var n models.Notification
		var message, link sql.NullString

		if err := rows.Scan(&n.ID, &n.UserID, &n.Title, &message,
			&n.Type, &n.IsRead, &link, &n.CreatedAt); err != nil {
			continue
		}

		if message.Valid { n.Message = &message.String }
		if link.Valid { n.Link = &link.String }

		database.DB.Where("id = ?", n.ID).FirstOrCreate(&n)
		count++
	}
	log.Printf("  ✅ %d notifications migrated", count)
}

func printSummary() {
	tables := []struct {
		name  string
		model interface{}
	}{
		{"States", &[]models.State{}},
		{"Countries", &[]models.Country{}},
		{"SystemSettings", &[]models.SystemSetting{}},
		{"Users", &[]models.User{}},
		{"Clients", &[]models.Client{}},
		{"BankAccounts", &[]models.BankAccount{}},
		{"Invoices", &[]models.Invoice{}},
		{"Quotations", &[]models.Quotation{}},
		{"Expenses", &[]models.Expense{}},
		{"OtherIncome", &[]models.OtherIncome{}},
		{"ActivityLogs", &[]models.ActivityLog{}},
		{"Notifications", &[]models.Notification{}},
	}

	log.Println("\n📊 Migration Summary:")
	log.Println(strings.Repeat("-", 35))
	for _, t := range tables {
		var count int64
		database.DB.Model(t.model).Count(&count)
		log.Printf("  %-20s %d rows", t.name, count)
	}
	log.Println(strings.Repeat("-", 35))

	_ = time.Now() // suppress unused import if needed
	_ = fmt.Sprintf // suppress unused import if needed
}
