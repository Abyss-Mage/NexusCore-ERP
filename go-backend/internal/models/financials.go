package models

import (
	"time"
)

// AccountType classifies accounts in the Chart of Accounts (COA)
type AccountType string

const (
	AccountTypeAsset     AccountType = "ASSET"
	AccountTypeLiability AccountType = "LIABILITY"
	AccountTypeEquity    AccountType = "EQUITY"
	AccountTypeRevenue   AccountType = "REVENUE"
	AccountTypeExpense   AccountType = "EXPENSE"
)

// Account represents an account in the standard Chart of Accounts
type Account struct {
	Code        string      `gorm:"primaryKey;size:20" json:"code"`
	Name        string      `gorm:"size:100;not null" json:"name"`
	Type        AccountType `gorm:"size:20;not null;index" json:"type"`
	Description string      `gorm:"size:255" json:"description"`
	IsSystem    bool        `gorm:"default:true" json:"is_system"`
	CreatedAt   time.Time   `gorm:"autoCreateTime" json:"created_at"`
}

func (Account) TableName() string { return "accounts" }

// JournalEntry represents a double-entry transaction header
type JournalEntry struct {
	ID             int           `gorm:"primaryKey;autoIncrement" json:"id"`
	EntryNumber    string        `gorm:"size:50;uniqueIndex;not null" json:"entry_number"`
	Date           time.Time     `gorm:"not null;index" json:"date"`
	ReferenceType  string        `gorm:"size:50;index" json:"reference_type"` // INVOICE, PAYMENT, EXPENSE, MANUAL, WOOCOMMERCE
	ReferenceID    string        `gorm:"size:100;index" json:"reference_id"`
	Description    string        `gorm:"type:text;not null" json:"description"`
	BusinessUnitID *string       `gorm:"type:varchar(50);index" json:"business_unit_id,omitempty"`
	Currency       string        `gorm:"size:10;default:INR" json:"currency"`
	Lines          []JournalLine `gorm:"foreignKey:JournalEntryID;constraint:OnDelete:CASCADE" json:"lines"`
	CreatedAt      time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time     `gorm:"autoUpdateTime" json:"updated_at"`
}

func (JournalEntry) TableName() string { return "journal_entries" }

// JournalLine represents a single debit or credit line item in a journal entry
type JournalLine struct {
	ID             int          `gorm:"primaryKey;autoIncrement" json:"id"`
	JournalEntryID int          `gorm:"not null;index" json:"journal_entry_id"`
	AccountCode    string       `gorm:"size:20;not null;index" json:"account_code"`
	Account        *Account     `gorm:"foreignKey:AccountCode" json:"account,omitempty"`
	Debit          float64      `gorm:"type:decimal(15,2);default:0.0" json:"debit"`
	Credit         float64      `gorm:"type:decimal(15,2);default:0.0" json:"credit"`
	Description    string       `gorm:"size:255" json:"description"`
	CreatedAt      time.Time    `gorm:"autoCreateTime" json:"created_at"`
}

func (JournalLine) TableName() string { return "journal_lines" }

// ExchangeRate stores cached FX rates against a base currency
type ExchangeRate struct {
	ID               int       `gorm:"primaryKey;autoIncrement" json:"id"`
	BaseCurrency     string    `gorm:"size:10;not null;index:idx_base_target,unique" json:"base_currency"`
	TargetCurrency   string    `gorm:"size:10;not null;index:idx_base_target,unique" json:"target_currency"`
	Rate             float64   `gorm:"type:decimal(18,6);not null" json:"rate"`
	LastUpdated      time.Time `gorm:"not null" json:"last_updated"`
	Source           string    `gorm:"size:50;default:OPEN_EXCHANGE" json:"source"`
	IsManualOverride bool      `gorm:"default:false" json:"is_manual_override"`
}

func (ExchangeRate) TableName() string { return "exchange_rates" }
