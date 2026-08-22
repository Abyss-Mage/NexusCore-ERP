package models

import "time"

// ClientDomain tracks domain and SSL expiries
type ClientDomain struct {
	ID               int        `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID         int        `gorm:"not null;index" json:"client_id"`
	Client           Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	DomainName       string     `gorm:"not null;uniqueIndex" json:"domain_name"`
	Provider         *string    `json:"provider,omitempty"`
	
	// Expiry & Renewal
	DomainExpiryDate *time.Time `json:"domain_expiry_date,omitempty"`
	AutoRenew        bool       `gorm:"default:true" json:"auto_renew"`
	RenewalPrice     float64    `gorm:"type:decimal(15,2);default:0" json:"renewal_price"`
	LastInvoiceDate  *time.Time `json:"last_invoice_date,omitempty"`
	Status           string     `gorm:"default:ACTIVE;not null" json:"status"` // ACTIVE, EXPIRING_SOON, EXPIRED

	// SSL Tracking
	HasSSL           bool       `json:"has_ssl"`
	SSLIssuer        string     `json:"ssl_issuer,omitempty"`
	SSLExpiryDate    *time.Time `json:"ssl_expiry_date,omitempty"` // Auto-fetched
	SSLStatus        string     `gorm:"default:VALID;not null" json:"ssl_status"` // VALID, EXPIRING_SOON, EXPIRED, NONE

	// DNS Tracking
	ARecords         string     `gorm:"type:text" json:"a_records,omitempty"`
	MXRecords        string     `gorm:"type:text" json:"mx_records,omitempty"`
	TXTRecords       string     `gorm:"type:text" json:"txt_records,omitempty"`

	Notes            *string    `gorm:"type:text" json:"notes,omitempty"`
	LastCheckedAt    *time.Time `json:"last_checked_at,omitempty"`
	CreatedAt        time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ClientDomain) TableName() string { return "client_domains" }

