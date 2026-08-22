package dto

import "time"

// ---- Auth DTOs ----

type SetupRequest struct {
	DBHost      string   `json:"db_host" binding:"required"`
	DBPort      string   `json:"db_port" binding:"required"`
	DBUser      string   `json:"db_user" binding:"required"`
	DBPassword  string   `json:"db_password"`
	DBName      string   `json:"db_name" binding:"required"`
	Email       string   `json:"email" binding:"required,email"`
	Password    string   `json:"password" binding:"required,min=8"`
	ChromePath  string   `json:"chrome_path"`
	CompanyName string   `json:"company_name"`
	CompanyCode string   `json:"company_code"`
	Industry    string   `json:"industry"`
	Currency    string   `json:"currency"`
	TaxID       string   `json:"tax_id"`
	Modules     []string `json:"modules"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	TOTPCode string `json:"totp_code"`
}

type ConnectRequest struct {
	ServerPassword string `json:"server_password" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID               int    `json:"id"`
	Email            string `json:"email"`
	Role             string `json:"role"`
	TwoFactorEnabled bool   `json:"two_factor_enabled"`
}

// ---- Client DTOs ----

type ClientRequest struct {
	CompanyName    string      `json:"company_name" binding:"required"`
	ContactPerson  *string     `json:"contact_person"`
	TaxID          *string     `json:"tax_id"`
	CIN            *string     `json:"cin"`
	State          *string     `json:"state"`
	Country        string      `json:"country"`
	Email          *string     `json:"email"`
	Phone          *string     `json:"phone"`
	Addresses      interface{} `json:"addresses"`
	BusinessUnitID *string     `json:"business_unit_id"`
}

// ---- Invoice DTOs ----

type InvoiceRequest struct {
	ClientID       int         `json:"client_id" binding:"required"`
	BankAccountID  *int        `json:"bank_account_id"`
	IssueDate      time.Time   `json:"issue_date" binding:"required"`
	DueDate        *time.Time  `json:"due_date"`
	Currency       string      `json:"currency"`
	LineItems      interface{} `json:"line_items" binding:"required"`
	Remarks        *string     `json:"remarks"`
	Category       *string     `json:"category"`
	IsManualEntry  bool        `json:"is_manual_entry"`
	InvoiceNumber  *string     `json:"invoice_number"`
	BusinessUnitID *string     `json:"business_unit_id"`
}

type InvoiceStatusUpdate struct {
	Status         string     `json:"status" binding:"required"`
	PaymentDate    *time.Time `json:"payment_date"`
	ReceivedAmount *float64   `json:"received_amount"`
}

// ---- Quotation DTOs ----

type QuotationRequest struct {
	ClientID        int         `json:"client_id" binding:"required"`
	BankAccountID   *int        `json:"bank_account_id"`
	IssueDate       time.Time   `json:"issue_date" binding:"required"`
	ExpiryDate      *time.Time  `json:"expiry_date"`
	LineItems       interface{} `json:"line_items" binding:"required"`
	ServicesOffered *string     `json:"services_offered"`
	ContractTerms   *string     `json:"contract_terms"`
	Remarks         *string     `json:"remarks"`
	Currency        string      `json:"currency"`
	IsManualEntry   bool        `json:"is_manual_entry"`
	QuotationNumber *string     `json:"quotation_number"`
	BusinessUnitID  *string     `json:"business_unit_id"`
}

// ---- Expense DTOs ----

type ExpenseRequest struct {
	Category       string    `json:"category" binding:"required"`
	Amount         float64   `json:"amount" binding:"required"`
	Date           time.Time `json:"date" binding:"required"`
	Description    *string   `json:"description"`
	BusinessUnitID *string   `json:"business_unit_id"`
}

// ---- OtherIncome DTOs ----

type OtherIncomeRequest struct {
	Category    string    `json:"category" binding:"required"`
	Amount      float64   `json:"amount" binding:"required"`
	Date        time.Time `json:"date" binding:"required"`
	Description *string   `json:"description"`
}

// ---- BankAccount DTOs ----

type BankAccountRequest struct {
	Label         string  `json:"label" binding:"required"`
	Currency      string  `json:"currency"`
	IsDefault     bool    `json:"is_default"`
	BankName      string  `json:"bank_name" binding:"required"`
	AccountHolder string  `json:"account_holder" binding:"required"`
	AccountNumber string  `json:"account_number" binding:"required"`
	RoutingNumber *string `json:"routing_number"`
	SwiftCode     *string `json:"swift_code"`
	IFSCCode      *string `json:"ifsc_code"`
	IBAN          *string `json:"iban"`
	SortCode      *string `json:"sort_code"`
	BranchAddress *string `json:"branch_address"`
	UPIID         *string `json:"upi_id"`
	PaymentMethod *string `json:"payment_method"`
}

// ---- Settings DTOs ----

type SettingRequest struct {
	Key       string      `json:"key" binding:"required"`
	Value     *string     `json:"value"`
	JSONValue interface{} `json:"json_value"`
}

// ---- User Management DTOs ----

type CreateUserRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// ---- 2FA DTOs ----

type Enable2FARequest struct {
	TOTPCode string `json:"totp_code" binding:"required"`
}

type Disable2FARequest struct {
	BackupCode string `json:"backup_code" binding:"required"`
}

// ---- Dashboard DTOs ----

type DashboardFilter struct {
	StartDate *time.Time `form:"start_date"`
	EndDate   *time.Time `form:"end_date"`
}

// ---- Pagination ----

type PaginationQuery struct {
	Page     int    `form:"page,default=1"`
	Limit    int    `form:"limit,default=20"`
	Search   string `form:"search"`
	SortBy   string `form:"sort_by"`
	SortDir  string `form:"sort_dir,default=desc"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}
