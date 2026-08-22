package models

import "time"

// RecurringInvoice automates billing
type RecurringInvoice struct {
	ID             int          `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID       int          `gorm:"not null;index" json:"client_id"`
	Client         Client       `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	BankAccountID  *int         `gorm:"index" json:"bank_account_id,omitempty"`
	BankAccount    *BankAccount `gorm:"foreignKey:BankAccountID" json:"bank_account,omitempty"`
	Currency       string       `gorm:"default:INR;not null" json:"currency"`
	BaseCurrency   string       `gorm:"default:INR;not null" json:"base_currency"`
	ExchangeRate   float64      `gorm:"type:decimal(10,6);default:1.0" json:"exchange_rate"`
	LineItems      JSONArray    `gorm:"serializer:json;default:'[]'" json:"line_items"`
	TaxSummary     JSONMap      `gorm:"serializer:json;default:'{}'" json:"tax_summary"`
	Subtotal       float64      `gorm:"type:decimal(15,2);default:0" json:"subtotal"`
	GrandTotal     float64      `gorm:"type:decimal(15,2);default:0" json:"grand_total"`
	Category       *string      `gorm:"size:100" json:"category,omitempty"`
	Remarks        *string      `gorm:"type:text" json:"remarks,omitempty"`
	Frequency      string       `gorm:"default:MONTHLY;not null" json:"frequency"`
	NextRunDate    time.Time    `gorm:"not null" json:"next_run_date"`
	LastRunDate    *time.Time   `json:"last_run_date,omitempty"`
	AutoEmail      bool         `gorm:"default:false" json:"auto_email"`
	Status         string       `gorm:"default:ACTIVE;not null" json:"status"`
	CreatedAt      time.Time    `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time    `gorm:"autoUpdateTime" json:"updated_at"`
	BusinessUnitID *string      `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`
}

func (RecurringInvoice) TableName() string { return "recurring_invoices" }

// RetainerContract tracks budgeted hours
type RetainerContract struct {
	ID                int        `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID          int        `gorm:"not null;index" json:"client_id"`
	Client            Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	MonthlyHours      float64    `gorm:"type:decimal(10,2);not null" json:"monthly_hours"`
	HourlyRate        float64    `gorm:"type:decimal(15,2);not null" json:"hourly_rate"`
	OverageHourlyRate float64    `gorm:"type:decimal(15,2);default:0" json:"overage_hourly_rate"`
	Status            string     `gorm:"default:ACTIVE;not null" json:"status"`
	StartDate         time.Time  `gorm:"not null" json:"start_date"`
	NextRunDate       *time.Time `json:"next_run_date"`
	LastRunDate       *time.Time `json:"last_run_date,omitempty"`
	CreatedAt         time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (RetainerContract) TableName() string { return "retainer_contracts" }

// TimeEntry tracks actual work
type TimeEntry struct {
	ID              int              `gorm:"primaryKey;autoIncrement" json:"id"`
	ContractID      int              `gorm:"not null;index" json:"contract_id"`
	Contract        RetainerContract `gorm:"foreignKey:ContractID" json:"contract,omitempty"`
	Date            time.Time        `gorm:"not null" json:"date"`
	DurationMinutes int              `gorm:"not null" json:"duration_minutes"`
	Description     string           `gorm:"type:text;not null" json:"description"`
	CreatedAt       time.Time        `gorm:"autoCreateTime" json:"created_at"`
}

func (TimeEntry) TableName() string { return "time_entries" }

// SoftwareProject tracks agile client projects
type SoftwareProject struct {
	ID          int                `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID    int                `gorm:"not null;index" json:"client_id"`
	Client      Client             `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Name        string             `gorm:"not null" json:"name"`
	Description *string            `gorm:"type:text" json:"description,omitempty"`
	TotalBudget float64            `gorm:"type:decimal(15,2);default:0" json:"total_budget"`
	Currency    string             `gorm:"default:INR;not null" json:"currency"`
	Status      string             `gorm:"default:IN_PROGRESS;not null" json:"status"` // PLANNING, IN_PROGRESS, COMPLETED, ON_HOLD
	StartDate   *time.Time         `json:"start_date,omitempty"`
	Deadline    *time.Time         `json:"deadline,omitempty"`
	Milestones  []ProjectMilestone `gorm:"foreignKey:ProjectID" json:"milestones,omitempty"`
	CreatedAt   time.Time          `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time          `gorm:"autoUpdateTime" json:"updated_at"`
}

func (SoftwareProject) TableName() string { return "software_projects" }

// ProjectMilestone tracks project phase billing
type ProjectMilestone struct {
	ID          int             `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID   int             `gorm:"not null;index" json:"project_id"`
	Project     SoftwareProject `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	Title       string          `gorm:"not null" json:"title"`
	Description *string         `gorm:"type:text" json:"description,omitempty"`
	Amount      float64         `gorm:"type:decimal(15,2);not null" json:"amount"`
	Percentage  float64         `gorm:"type:decimal(5,2);default:0" json:"percentage"`
	DueDate     *time.Time      `json:"due_date,omitempty"`
	Status      string          `gorm:"default:PENDING;not null" json:"status"` // PENDING, IN_PROGRESS, COMPLETED, INVOICED
	InvoiceID   *int            `gorm:"index" json:"invoice_id,omitempty"`
	Invoice     *Invoice        `gorm:"foreignKey:InvoiceID" json:"invoice,omitempty"`
	CreatedAt   time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ProjectMilestone) TableName() string { return "project_milestones" }

