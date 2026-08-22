package models

import "time"

// Proposal represents a Quotation + SOW
type Proposal struct {
	ID            int        `gorm:"primaryKey;autoIncrement" json:"id"`
	ProposalNum   string     `gorm:"uniqueIndex;not null" json:"proposal_num"`
	ClientID      int        `gorm:"not null;index" json:"client_id"`
	Client        Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Title         string     `gorm:"not null" json:"title"`
	IssueDate     time.Time  `gorm:"not null" json:"issue_date"`
	ExpiryDate    *time.Time `json:"expiry_date,omitempty"`
	Status        string     `gorm:"default:DRAFT;not null" json:"status"`
	ScopeOfWork   *string    `gorm:"type:text" json:"scope_of_work,omitempty"`
	Milestones    JSONArray  `gorm:"serializer:json" json:"milestones,omitempty"`
	LineItems     JSONArray  `gorm:"serializer:json;not null" json:"line_items"`
	Subtotal      float64    `gorm:"type:decimal(15,2);not null" json:"subtotal"`
	GrandTotal    float64    `gorm:"type:decimal(15,2);not null" json:"grand_total"`
	Currency      string     `gorm:"default:INR;not null" json:"currency"`
	PDFKey        *string    `gorm:"size:255" json:"pdf_key,omitempty"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Proposal) TableName() string { return "proposals" }

// ProposalSequence handles auto-incrementing proposal numbers
type ProposalSequence struct {
	ID         int    `gorm:"primaryKey;autoIncrement" json:"id"`
	FiscalYear string `gorm:"uniqueIndex;not null" json:"fiscal_year"`
	LastCount  int    `gorm:"default:0;not null" json:"last_count"`
}

func (ProposalSequence) TableName() string { return "proposal_sequences" }
