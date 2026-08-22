package models

import (
	"time"
)

// SoftwareTask represents a ticket/card on the Software Development Kanban Board
type SoftwareTask struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Title       string    `gorm:"not null" json:"title"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	Status      string    `gorm:"default:BACKLOG;not null" json:"status"` // BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE
	Priority    string    `gorm:"default:MEDIUM;not null" json:"priority"` // LOW, MEDIUM, HIGH, URGENT
	Assignee    *string   `json:"assignee,omitempty"`
	ClientID    *int      `gorm:"index" json:"client_id,omitempty"` // Link task to a client
	Client      *Client   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	Labels      *JSONArray `gorm:"serializer:json" json:"labels,omitempty"`
	OrderIndex  int       `gorm:"default:0" json:"order_index"` // For sorting within a lane
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	BusinessUnitID *string  `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`
}

func (SoftwareTask) TableName() string { return "software_tasks" }

// ServerMonitor represents a server being tracked by the Uptime Robot
type ServerMonitor struct {
	ID               int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID         *int      `gorm:"index" json:"client_id,omitempty"` // Who owns this server
	Client           *Client   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Name             string    `gorm:"not null" json:"name"`
	URL              string    `gorm:"not null" json:"url"`
	Status           string    `gorm:"default:UNKNOWN;not null" json:"status"` // UP, DOWN, PAUSED, UNKNOWN
	CheckIntervalMin int       `gorm:"default:5;not null" json:"check_interval_min"`
	LastChecked      *time.Time `json:"last_checked,omitempty"`
	LastStatusChange *time.Time `json:"last_status_change,omitempty"`
	UptimePercentage float64   `gorm:"type:decimal(5,2);default:100.0" json:"uptime_percentage"`
	IsPaused         bool      `gorm:"default:false" json:"is_paused"`
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ServerMonitor) TableName() string { return "server_monitors" }

// ServerPingLog records individual ping results for the Uptime Robot
type ServerPingLog struct {
	ID             int           `gorm:"primaryKey;autoIncrement" json:"id"`
	MonitorID      int           `gorm:"not null;index" json:"monitor_id"`
	Monitor        ServerMonitor `gorm:"foreignKey:MonitorID" json:"-"`
	Timestamp      time.Time     `gorm:"autoCreateTime;index" json:"timestamp"`
	StatusCode     int           `json:"status_code"` // e.g., 200, 404, 500, or 0 if timeout
	ResponseTimeMs int           `json:"response_time_ms"`
	IsSuccess      bool          `gorm:"not null" json:"is_success"`
	ErrorMessage   *string       `gorm:"type:text" json:"error_message,omitempty"`
}

func (ServerPingLog) TableName() string { return "server_ping_logs" }

// Credential represents a securely stored client credential (AES-256)
type Credential struct {
	ID                int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID          int       `gorm:"not null;index" json:"client_id"`
	Client            Client    `gorm:"foreignKey:ClientID" json:"-"`
	ServiceName       string    `gorm:"not null" json:"service_name"` // e.g. cPanel, AWS, WordPress
	URL               *string   `json:"url,omitempty"`
	Username          string    `gorm:"not null" json:"username"` // We will leave this plaintext so we can search by username
	EncryptedPassword string    `gorm:"not null" json:"encrypted_password"` // AES-256 encrypted
	Notes             *string   `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt         time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Credential) TableName() string { return "client_credentials" }

// VaultAuditLog records immutable access trail for credential reveals, updates, and deletes
type VaultAuditLog struct {
	ID           int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       int       `gorm:"not null;index" json:"user_id"`
	UserEmail    string    `json:"user_email"`
	CredentialID *int      `gorm:"index" json:"credential_id,omitempty"`
	ServiceName  string    `json:"service_name"`
	ClientID     *int      `gorm:"index" json:"client_id,omitempty"`
	ClientName   string    `json:"client_name"`
	Action       string    `gorm:"not null" json:"action"` // VIEW_PASSWORD, CREATE_SECRET, UPDATE_SECRET, DELETE_SECRET
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	CreatedAt    time.Time `gorm:"autoCreateTime;index" json:"created_at"`
}

func (VaultAuditLog) TableName() string { return "vault_audit_logs" }

