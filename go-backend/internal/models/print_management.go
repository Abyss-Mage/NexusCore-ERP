package models

import (
	"time"
)

// Printer represents a 3D printer in the fleet (Bambu Cloud & LAN telemetry)
type Printer struct {
	ID               int        `gorm:"primaryKey;autoIncrement" json:"id"`
	BusinessUnitID   *string    `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`
	Name             string     `gorm:"not null" json:"name"`
	Make             string     `gorm:"not null" json:"make"`
	ConnectionType   string     `gorm:"default:'cloud';not null" json:"connection_type"` // cloud, lan
	CloudRegion      string     `gorm:"default:'us';not null" json:"cloud_region"`       // us, eu, cn
	CloudToken       string     `json:"cloud_token,omitempty"`
	IPAddress        string     `gorm:"default:'';not null" json:"ip_address"`
	SerialNumber     string     `gorm:"default:'';not null" json:"serial_number"`
	AccessCode       string     `json:"access_code,omitempty"`
	Status           string     `gorm:"default:'Offline';not null" json:"status"` // Active, Printing, Idle, Maintenance, Offline
	CurrentJob       *string    `json:"current_job,omitempty"`
	Progress         int        `gorm:"default:0" json:"progress"`
	NozzleTemp       float64    `gorm:"default:0" json:"nozzle_temp"`
	NozzleTargetTemp float64    `gorm:"default:0" json:"nozzle_target_temp"`
	BedTemp          float64    `gorm:"default:0" json:"bed_temp"`
	BedTargetTemp    float64    `gorm:"default:0" json:"bed_target_temp"`
	LayerNum         int        `gorm:"default:0" json:"layer_num"`
	TotalLayers      int        `gorm:"default:0" json:"total_layers"`
	RemainingMinutes     int        `gorm:"default:0" json:"remaining_minutes"`
	HourlyRate           float64    `gorm:"type:decimal(10,2);not null;default:0" json:"hourly_rate"`
	PowerWatts           float64    `gorm:"type:decimal(10,2);not null;default:350" json:"power_watts"`
	PurchasePrice        float64    `gorm:"type:decimal(12,2);not null;default:120000" json:"purchase_price"`
	LifespanHours        float64    `gorm:"type:decimal(10,2);not null;default:5000" json:"lifespan_hours"`
	ElectricityRatePerKwh float64   `gorm:"type:decimal(8,2);not null;default:8.50" json:"electricity_rate_per_kwh"`
	LaborRatePerHour     float64    `gorm:"type:decimal(10,2);not null;default:250" json:"labor_rate_per_hour"`
	LastSeen             *time.Time `json:"last_seen,omitempty"`
	CreatedAt            time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	PrintJobs []PrintJob `gorm:"foreignKey:PrinterID" json:"print_jobs,omitempty"`
}

func (Printer) TableName() string { return "printers" }


// Filament represents filament spool inventory
type Filament struct {
	ID                   int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Brand                string    `gorm:"default:'Bambu Lab';not null" json:"brand"`
	MaterialType         string    `gorm:"not null" json:"material_type"` // PLA, PETG, ABS, ASA, TPU, etc.
	Color                string    `gorm:"not null" json:"color"`
	ColorHex             string    `gorm:"default:'#3B82F6'" json:"color_hex"`
	InitialWeightGrams   float64   `gorm:"type:decimal(10,2);not null;default:1000" json:"initial_weight_grams"`
	RemainingWeightGrams float64   `gorm:"type:decimal(10,2);not null;default:1000" json:"remaining_weight_grams"`
	SpoolPrice           float64   `gorm:"type:decimal(10,2);not null;default:0" json:"spool_price"`
	CostPerGram          float64   `gorm:"type:decimal(10,4);not null;default:0" json:"cost_per_gram"`
	Density              float64   `gorm:"type:decimal(6,3);not null;default:1.24" json:"density"`
	DiameterMm           float64   `gorm:"type:decimal(4,2);not null;default:1.75" json:"diameter_mm"`
	Location             string    `gorm:"default:'Main Storage'" json:"location"`
	Status               string    `gorm:"default:'In Stock';not null" json:"status"` // In Stock, Low Stock, Depleted
	CreatedAt            time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	PrintJobs []PrintJob `gorm:"foreignKey:FilamentID" json:"print_jobs,omitempty"`
}

func (Filament) TableName() string { return "filaments" }


// PrintJob tracks individual 3D printing jobs (Kanban) with full Unit Economics
type PrintJob struct {
	ID                  int       `gorm:"primaryKey;autoIncrement" json:"id"`
	BusinessUnitID      *string   `gorm:"type:uuid;index" json:"business_unit_id,omitempty"`
	Title               string    `gorm:"not null" json:"title"`
	Description         *string   `gorm:"type:text" json:"description,omitempty"`
	Status              string    `gorm:"default:Pending;not null" json:"status"` // Pending, Printing, Done
	PrinterID           *int      `gorm:"index" json:"printer_id,omitempty"`
	Printer             *Printer  `gorm:"foreignKey:PrinterID" json:"printer,omitempty"`
	FilamentID          *int      `gorm:"index" json:"filament_id,omitempty"`
	Filament            *Filament `gorm:"foreignKey:FilamentID" json:"filament,omitempty"`
	EstimatedTimeHours  float64   `gorm:"type:decimal(10,2);not null;default:0" json:"estimated_time_hours"`
	FilamentWeightGrams float64   `gorm:"type:decimal(10,2);not null;default:0" json:"filament_weight_grams"`
	LaborHours          float64   `gorm:"type:decimal(8,2);not null;default:0.25" json:"labor_hours"`
	
	// True Unit Economics Cost Breakdown
	FilamentCost        float64   `gorm:"type:decimal(12,2);not null;default:0" json:"filament_cost"`
	DepreciationCost    float64   `gorm:"type:decimal(12,2);not null;default:0" json:"depreciation_cost"`
	ElectricityCost     float64   `gorm:"type:decimal(12,2);not null;default:0" json:"electricity_cost"`
	LaborCost           float64   `gorm:"type:decimal(12,2);not null;default:0" json:"labor_cost"`
	TotalCost           float64   `gorm:"type:decimal(15,2);not null;default:0" json:"total_cost"`
	
	// Revenue & Profitability
	Revenue             float64   `gorm:"type:decimal(15,2);not null;default:0" json:"revenue"`
	NetProfit           float64   `gorm:"type:decimal(15,2);not null;default:0" json:"net_profit"`
	NetMarginPercent    float64   `gorm:"type:decimal(6,2);not null;default:0" json:"net_margin_percent"`

	ClientID            *int      `gorm:"index" json:"client_id,omitempty"`
	Client              *Client   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (PrintJob) TableName() string { return "print_jobs" }
