package models

import (
	"time"

	"gorm.io/gorm"
)

// JSONMap represents a JSON object
type JSONMap map[string]interface{}

// JSONArray represents a JSON array
type JSONArray []interface{}

// SystemSetting stores key-value configuration pairs
type SystemSetting struct {
	Key       string          `gorm:"primaryKey;size:50" json:"key"`
	Value     *string         `gorm:"type:text" json:"value,omitempty"`
	JSONValue *JSONMap         `gorm:"serializer:json" json:"json_value,omitempty"`
	IsLocked  bool            `gorm:"default:false" json:"is_locked"`
}

func (SystemSetting) TableName() string { return "system_settings" }

// User represents system users with RBAC and 2FA
type User struct {
	ID                int            `gorm:"primaryKey;autoIncrement" json:"id"`
	Email             string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash      string         `gorm:"not null" json:"-"`
	Role              string         `gorm:"default:ADMIN;not null" json:"role"`
	TwoFactorSecret   *string        `json:"-"`
	TwoFactorEnabled  bool           `gorm:"default:false" json:"two_factor_enabled"`
	BackupCodes       *JSONArray     `gorm:"serializer:json" json:"-"`
	ResetToken        *string        `gorm:"uniqueIndex" json:"-"`
	ResetTokenExpiry  *time.Time     `json:"-"`
	CreatedAt         time.Time      `gorm:"autoCreateTime" json:"created_at"`
	BusinessUnitID    *string        `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`

	// Relations
	Notifications []Notification `gorm:"foreignKey:UserID" json:"notifications,omitempty"`
	Activities    []ActivityLog  `gorm:"foreignKey:UserID" json:"activities,omitempty"`
}

func (User) TableName() string { return "users" }

// ActivityLog stores audit trail entries
type ActivityLog struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      int       `gorm:"not null;index" json:"user_id"`
	User        User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Action      string    `gorm:"not null" json:"action"`
	Description string    `gorm:"not null" json:"description"`
	EntityType  *string   `json:"entity_type,omitempty"`
	EntityID    *string   `json:"entity_id,omitempty"`
	IPAddress   *string   `json:"ip_address,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	Timezone    string    `gorm:"default:Asia/Kolkata" json:"timezone"`
}

func (ActivityLog) TableName() string { return "activity_logs" }

// Notification stores user alerts
type Notification struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int       `gorm:"not null;index" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Title     string    `gorm:"not null" json:"title"`
	Message   *string   `gorm:"type:text" json:"message,omitempty"`
	Type      string    `gorm:"default:INFO;not null" json:"type"`
	IsRead    bool      `gorm:"default:false" json:"is_read"`
	Link      *string   `json:"link,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (Notification) TableName() string { return "notifications" }

// Client represents CRM contacts
type Client struct {
	ID            int       `gorm:"primaryKey;autoIncrement" json:"id"`
	CompanyName   string    `gorm:"not null" json:"company_name"`
	ContactPerson *string   `json:"contact_person,omitempty"`
	TaxID         *string   `json:"tax_id,omitempty"`
	CIN           *string   `json:"cin,omitempty"`
	State         *string   `json:"state,omitempty"`
	Country       string    `gorm:"not null" json:"country"`
	Email         *string   `json:"email,omitempty"`
	Phone         *string   `json:"phone,omitempty"`
	Addresses     *JSONMap  `gorm:"serializer:json" json:"addresses,omitempty"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	BusinessUnitID *string  `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`

	// Relations
	Invoices   []Invoice   `gorm:"foreignKey:ClientID" json:"invoices,omitempty"`
	Quotations []Quotation `gorm:"foreignKey:ClientID" json:"quotations,omitempty"`
}

func (Client) TableName() string { return "clients" }

// BankAccount stores banking details for invoicing
type BankAccount struct {
	ID            int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Label         string    `gorm:"not null" json:"label"`
	Currency      string    `gorm:"default:USD;not null" json:"currency"`
	IsDefault     bool      `gorm:"default:false" json:"is_default"`
	BankName      string    `gorm:"not null" json:"bank_name"`
	AccountHolder string    `gorm:"not null" json:"account_holder"`
	AccountNumber string    `gorm:"not null" json:"account_number"`
	RoutingNumber *string   `json:"routing_number,omitempty"`
	SwiftCode     *string   `json:"swift_code,omitempty"`
	IFSCCode      *string   `json:"ifsc_code,omitempty"`
	IBAN          *string   `json:"iban,omitempty"`
	SortCode      *string   `json:"sort_code,omitempty"`
	BranchAddress *string   `gorm:"type:text" json:"branch_address,omitempty"`
	UPIID         *string   `json:"upi_id,omitempty"`
	PaymentMethod *string   `json:"payment_method,omitempty"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relations
	Invoices   []Invoice   `gorm:"foreignKey:BankAccountID" json:"invoices,omitempty"`
	Quotations []Quotation `gorm:"foreignKey:BankAccountID" json:"quotations,omitempty"`
}

func (BankAccount) TableName() string { return "bank_accounts" }

// Invoice represents sales documents
type Invoice struct {
	ID             int        `gorm:"primaryKey;autoIncrement" json:"id"`
	InvoiceNumber  string     `gorm:"uniqueIndex;not null" json:"invoice_number"`
	ClientID       int        `gorm:"not null;index" json:"client_id"`
	Client         Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	BankAccountID  *int       `gorm:"index" json:"bank_account_id,omitempty"`
	BankAccount    *BankAccount `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	Status         string     `gorm:"default:DRAFT;not null" json:"status"`
	IssueDate      time.Time  `gorm:"not null" json:"issue_date"`
	DueDate        *time.Time `json:"due_date,omitempty"`
	PaymentDate    *time.Time `json:"payment_date,omitempty"`
	Currency       string     `gorm:"default:INR;not null" json:"currency"`
	BaseCurrency   string     `gorm:"default:INR;not null" json:"base_currency"`
	ExchangeRate   float64    `gorm:"type:decimal(10,6);default:1.0" json:"exchange_rate"`
	ReceivedAmount *float64   `gorm:"type:decimal(15,2)" json:"received_amount,omitempty"`
	LineItems      JSONArray  `gorm:"serializer:json;not null" json:"line_items"`
	TaxSummary     JSONMap    `gorm:"serializer:json;not null" json:"tax_summary"`
	Subtotal       float64    `gorm:"type:decimal(15,2);not null" json:"subtotal"`
	GrandTotal     float64    `gorm:"type:decimal(15,2);not null" json:"grand_total"`
	Category       *string    `gorm:"size:100" json:"category,omitempty"`
	Remarks        *string    `gorm:"type:text" json:"remarks,omitempty"`
	PDFKey         *string    `gorm:"size:255" json:"pdf_key,omitempty"`
	IsManualEntry  bool       `gorm:"default:false" json:"is_manual_entry"`
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	BusinessUnitID *string    `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`
}

func (Invoice) TableName() string { return "invoices" }

// Quotation represents proposals/estimates
type Quotation struct {
	ID              int        `gorm:"primaryKey;autoIncrement" json:"id"`
	QuotationNumber string     `gorm:"uniqueIndex;not null" json:"quotation_number"`
	ClientID        int        `gorm:"not null;index" json:"client_id"`
	Client          Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	BankAccountID   *int       `gorm:"index" json:"bank_account_id,omitempty"`
	BankAccount     *BankAccount `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	IssueDate       time.Time  `gorm:"not null" json:"issue_date"`
	ExpiryDate      *time.Time `json:"expiry_date,omitempty"`
	Status          string     `gorm:"default:DRAFT;not null" json:"status"`
	LineItems       JSONArray  `gorm:"serializer:json;not null" json:"line_items"`
	ServicesOffered *string    `gorm:"type:text" json:"services_offered,omitempty"`
	ContractTerms   *string    `gorm:"type:text" json:"contract_terms,omitempty"`
	Remarks         *string    `gorm:"type:text" json:"remarks,omitempty"`
	Subtotal        float64    `gorm:"type:decimal(15,2);not null" json:"subtotal"`
	GrandTotal      float64    `gorm:"type:decimal(15,2);not null" json:"grand_total"`
	Currency        string     `gorm:"default:INR;not null" json:"currency"`
	BaseCurrency    string     `gorm:"default:INR;not null" json:"base_currency"`
	ExchangeRate    float64    `gorm:"type:decimal(10,6);default:1.0" json:"exchange_rate"`
	PDFKey          *string    `gorm:"size:255" json:"pdf_key,omitempty"`
	IsManualEntry   bool       `gorm:"default:false" json:"is_manual_entry"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	BusinessUnitID  *string    `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`
}

func (Quotation) TableName() string { return "quotations" }

// Expense tracks business expenses
type Expense struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Category    string    `gorm:"not null" json:"category"`
	Amount      float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	Date        time.Time `gorm:"not null" json:"date"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (Expense) TableName() string { return "expenses" }

// OtherIncome tracks non-invoice revenue
type OtherIncome struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Category    string    `gorm:"not null" json:"category"`
	Amount      float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	Date        time.Time `gorm:"not null" json:"date"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (OtherIncome) TableName() string { return "other_incomes" }

// InvoiceSequence handles auto-incrementing invoice numbers per fiscal year
type InvoiceSequence struct {
	ID         int    `gorm:"primaryKey;autoIncrement" json:"id"`
	FiscalYear string `gorm:"uniqueIndex;not null" json:"fiscal_year"`
	LastCount  int    `gorm:"default:0;not null" json:"last_count"`
}

func (InvoiceSequence) TableName() string { return "invoice_sequences" }

// QuotationSequence handles auto-incrementing quotation numbers
type QuotationSequence struct {
	ID         int    `gorm:"primaryKey;autoIncrement" json:"id"`
	FiscalYear string `gorm:"uniqueIndex;not null" json:"fiscal_year"`
	LastCount  int    `gorm:"default:0;not null" json:"last_count"`
}

func (QuotationSequence) TableName() string { return "quotation_sequences" }

// State stores Indian states for GST tax logic
type State struct {
	Code    int    `gorm:"primaryKey" json:"code"`
	Name    string `gorm:"not null" json:"name"`
	Country string `gorm:"default:India;not null" json:"country"`
}

func (State) TableName() string { return "states" }

// Country stores country reference data
type Country struct {
	ISOCode   string  `gorm:"primaryKey;size:5" json:"iso_code"`
	Name      string  `gorm:"size:100;not null" json:"name"`
	Currency  *string `gorm:"size:50" json:"currency,omitempty"`
	PhoneCode *string `gorm:"size:10" json:"phone_code,omitempty"`
}

func (Country) TableName() string { return "countries" }

// AutoMigrateAll runs GORM auto-migration for all models
func AutoMigrateAll(db *gorm.DB) error {
	return db.AutoMigrate(
		&SystemSetting{},
		&BusinessUnit{},
		&Printer{},
		&PrintJob{},
		&User{},
		&ActivityLog{},
		&Notification{},
		&Client{},
		&BankAccount{},
		&Invoice{},
		&Quotation{},
		&Expense{},
		&OtherIncome{},
		&InvoiceSequence{},
		&QuotationSequence{},
		&State{},
		&Country{},
		&RecurringInvoice{},
		&RetainerContract{},
		&TimeEntry{},
		&ClientDomain{},
		&Proposal{},
		&ProposalSequence{},
		&Printer{},
		&Filament{},
		&PrintJob{},
		&SoftwareTask{},
		&ServerMonitor{},
		&ServerPingLog{},
		&Credential{},
		&VaultAuditLog{},
		&SoftwareProject{},
		&ProjectMilestone{},
	)
}
