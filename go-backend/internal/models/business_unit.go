package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BusinessUnit struct {
	ID                  string         `gorm:"size:50;primaryKey" json:"id"`
	Code                string         `gorm:"size:20;not null;default:'DEFAULT'" json:"code"`
	Name                string         `gorm:"type:varchar(255);not null" json:"name"`
	Category            string         `gorm:"size:100;default:'General'" json:"category"`
	Description         string         `gorm:"type:text" json:"description"`
	InvoicePrefix       string         `gorm:"size:50;default:'INV-'" json:"invoice_prefix"`
	QuotationPrefix     string         `gorm:"size:50;default:'QT-'" json:"quotation_prefix"`
	ActiveModules       JSONArray      `gorm:"serializer:json" json:"active_modules"`
	Currency            string         `gorm:"size:10;default:'INR'" json:"currency"`
	TaxID               *string        `gorm:"size:50" json:"tax_id,omitempty"`
	Email               *string        `gorm:"size:150" json:"email,omitempty"`
	Website             *string        `gorm:"size:255" json:"website,omitempty"`
	Address             *JSONMap       `gorm:"serializer:json" json:"address,omitempty"`
	BankDetails         *JSONMap       `gorm:"serializer:json" json:"bank_details,omitempty"`
	WooCommerceSettings *JSONMap       `gorm:"serializer:json" json:"woocommerce_settings,omitempty"`
	IsDefault           bool           `gorm:"default:false" json:"is_default"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Clients           []Client           `gorm:"foreignKey:BusinessUnitID" json:"clients,omitempty"`
	Invoices          []Invoice          `gorm:"foreignKey:BusinessUnitID" json:"invoices,omitempty"`
	Quotations        []Quotation        `gorm:"foreignKey:BusinessUnitID" json:"quotations,omitempty"`
	RecurringInvoices []RecurringInvoice `gorm:"foreignKey:BusinessUnitID" json:"recurring_invoices,omitempty"`
}

func (BusinessUnit) TableName() string { return "business_units" }

// BeforeCreate generates a UUID for the BusinessUnit before saving if one is not set
func (bu *BusinessUnit) BeforeCreate(tx *gorm.DB) (err error) {
	if bu.ID == "" {
		bu.ID = uuid.New().String()
	}
	return
}
