package handlers

import (
	"net/http"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/middleware"
	"github.com/anirban-guha/invoicecore/internal/storage"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	// Static file serving for uploads (Local Desktop Storage)
	r.Static("/api/storage", storage.GetBasePath())

	r.GET("/api/health", healthCheck)

	// Public routes (no auth required)
	auth := r.Group("/api/auth")
	{
		auth.GET("/status", AuthStatusHandler)
		auth.POST("/setup", SetupHandler)
		auth.POST("/login", middleware.RateLimit(), LoginHandler)
		auth.POST("/connect", ConnectHandler)
		auth.POST("/forgot-password", ForgotPasswordHandler)
		auth.POST("/reset-password", ResetPasswordHandler)
	}

	// Payment & E-Commerce Webhooks (Public - HMAC signature verified)
	webhooks := r.Group("/api/webhooks")
	{
		webhooks.POST("/razorpay", RazorpayWebhookHandler)
		webhooks.POST("/stripe", StripeWebhookHandler)
		webhooks.POST("/paypal", PayPalWebhookHandler)
		webhooks.POST("/woocommerce", WooCommerceWebhookHandler)
	}

	// Protected routes (auth required)
	api := r.Group("/api")
	api.Use(middleware.AuthRequired())
	{
		// Clients
		clients := api.Group("/clients")
		{
			clients.GET("", ListClients)
			clients.GET("/:id", GetClient)
			clients.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT", "STAFF"), CreateClient)
			clients.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT", "STAFF"), UpdateClient)
			clients.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteClient)
		}

		// Invoices
		invoices := api.Group("/invoices")
		{
			invoices.GET("", ListInvoices)
			invoices.GET("/shared", ListSharedInvoices) // must be before /:id
			invoices.POST("/calculate-tax", CalculateTaxHandler)
			invoices.GET("/:id", GetInvoice)
			invoices.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CreateInvoice)
			invoices.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateInvoice)
			invoices.PATCH("/:id/status", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateInvoiceStatus)
			invoices.POST("/:id/payment", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), RecordInvoicePayment)
			invoices.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteInvoice)
			invoices.GET("/:id/pdf", GetInvoicePDF)
			invoices.GET("/:id/pdf-data", GetInvoicePDFData)
			invoices.DELETE("/:id/pdf", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteInvoicePDF)
		}

		// Quotations
		quotations := api.Group("/quotations")
		{
			quotations.GET("", ListQuotations)
			quotations.GET("/:id", GetQuotation)
			quotations.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CreateQuotation)
			quotations.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateQuotation)
			quotations.PATCH("/:id/status", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateQuotationStatus)
			quotations.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteQuotation)
			quotations.GET("/:id/pdf", GetQuotationPDF)
			quotations.GET("/:id/pdf-data", GetQuotationPDFData)
			quotations.DELETE("/:id/pdf", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteQuotationPDF)
		}

		// Expenses
		expenses := api.Group("/expenses")
		{
			expenses.GET("", ListExpenses)
			expenses.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CreateExpense)
			expenses.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateExpense)
			expenses.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteExpense)
		}

		// Other Income
		income := api.Group("/income")
		{
			income.GET("", ListOtherIncome)
			income.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CreateOtherIncome)
			income.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateOtherIncome)
			income.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteOtherIncome)
		}

		// Bank Accounts
		banks := api.Group("/banks")
		{
			banks.GET("", ListBankAccounts)
			banks.GET("/:id", GetBankAccount)
			banks.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CreateBankAccount)
			banks.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateBankAccount)
			banks.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteBankAccount)
			banks.PATCH("/:id/default", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), SetDefaultBankAccount)
		}

		// Subscriptions / Recurring Invoices
		subscriptions := api.Group("/subscriptions")
		{
			subscriptions.GET("", ListRecurringInvoices)
			subscriptions.GET("/:id", GetRecurringInvoice)
			subscriptions.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CreateRecurringInvoice)
			subscriptions.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), UpdateRecurringInvoice)
			subscriptions.DELETE("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteRecurringInvoice)
		}

		// --- Software Firm Modules ---
		
		software := api.Group("/software")
		{
			software.GET("/retainer-contracts", ListRetainerContracts)
			software.POST("/retainer-contracts", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateRetainerContract)
			software.DELETE("/retainer-contracts/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteRetainerContract)

			software.GET("/time-entries", ListTimeEntries)
			software.POST("/time-entries", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateTimeEntry)
			
			// Domains & SSL Expiry Auto-Monitor
			software.GET("/domains", ListDomains)
			software.POST("/domains", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateDomain)
			software.PUT("/domains/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), UpdateDomain)
			software.DELETE("/domains/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteDomain)
			software.POST("/domains/:id/check", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CheckDomainSSL)
			software.POST("/domains/:id/invoice", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), GenerateDomainRenewalInvoice)

			// Projects & Milestone Billing
			software.GET("/projects", ListProjects)
			software.POST("/projects", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateProject)
			software.PUT("/projects/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), UpdateProject)
			software.DELETE("/projects/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteProject)
			software.POST("/projects/:projectId/milestones", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateMilestone)
			software.PUT("/milestones/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), UpdateMilestone)
			software.DELETE("/milestones/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteMilestone)
			software.POST("/milestones/:id/invoice", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), CompleteAndInvoiceMilestone)
			
			software.GET("/client-domains", ListClientDomains)
			software.POST("/client-domains", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateClientDomain)
			software.POST("/client-domains/:id/verify", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), VerifyClientDomain)
			software.DELETE("/client-domains/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteClientDomain)
			
			software.GET("/proposals", ListProposals)
			software.GET("/proposals/:id", GetProposal)
			software.POST("/proposals", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateProposal)

			// 3D Print Management
			software.GET("/printers", ListPrinters)
			software.POST("/printers", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), CreatePrinter)
			software.PUT("/printers/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), UpdatePrinter)
			software.DELETE("/printers/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeletePrinter)
			software.POST("/printers/:id/sync", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), SyncPrinterMQTT)
			software.POST("/printers/:id/command", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), CommandPrinter)
			
			software.GET("/filaments", ListFilaments)
			software.POST("/filaments", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), CreateFilament)
			software.PUT("/filaments/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), UpdateFilament)
			software.POST("/filaments/:id/adjust", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), AdjustFilamentWeight)
			software.DELETE("/filaments/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteFilament)

			software.GET("/print-jobs", ListPrintJobs)
			software.POST("/print-jobs", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), CreatePrintJob)
			software.PUT("/print-jobs/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), UpdatePrintJob)
			software.PATCH("/print-jobs/:id/status", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR"), UpdatePrintJobStatus)
			software.DELETE("/print-jobs/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeletePrintJob)

			// Software Kanban
			software.GET("/tasks", GetSoftwareTasks)
			software.POST("/tasks", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateSoftwareTask)
			software.PUT("/tasks/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), UpdateSoftwareTask)
			software.PATCH("/tasks/:id/status", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), UpdateSoftwareTaskStatus)
			software.DELETE("/tasks/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteSoftwareTask)

			// Server Monitors (Uptime)
			software.GET("/servers", GetServerMonitors)
			software.POST("/servers", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), CreateServerMonitor)
			software.PUT("/servers/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN", "STAFF"), UpdateServerMonitor)
			software.DELETE("/servers/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeleteServerMonitor)
			software.GET("/servers/:id/pings", GetServerPingLogs)

			// True Unit Economics (ROI Matrix)
			software.GET("/analytics/unit-economics", middleware.Authorize("SUDO_ADMIN", "ADMIN", "OPERATOR", "ACCOUNTANT"), GetUnitEconomicsAnalytics)

			// WooCommerce Integration (TYTGEAR Store)
			software.GET("/woocommerce/orders", GetWooCommerceOrders)
			software.GET("/woocommerce/config", GetWooCommerceConfig)
			software.POST("/woocommerce/config", middleware.Authorize("SUDO_ADMIN", "ADMIN"), SaveWooCommerceConfig)
		}

		// Business Units / Multi-Company Workspaces
		businessUnits := api.Group("/business-units")
		{
			businessUnits.GET("", ListBusinessUnits)
			businessUnits.GET("/:id", GetBusinessUnit)
			businessUnits.GET("/:id/stats", GetBusinessDashboardStats)
			businessUnits.POST("", middleware.Authorize("SUDO_ADMIN", "ADMIN"), CreateBusinessUnit)
			businessUnits.PUT("/:id", middleware.Authorize("SUDO_ADMIN", "ADMIN"), UpdateBusinessUnit)
			businessUnits.DELETE("/:id", middleware.Authorize("SUDO_ADMIN"), DeleteBusinessUnit)
		}

		// Credential Vault
		vault := api.Group("/vault")
		vault.Use(middleware.Authorize("SUDO_ADMIN", "ADMIN"))
		{
			vault.GET("/client/:clientId", GetClientCredentials)
			vault.GET("/:id/decrypted", GetDecryptedCredential)
			vault.GET("/pin-status", GetVaultPINStatus)
			vault.GET("/audit-logs", GetVaultAuditLogs)
			vault.POST("/set-pin", SetVaultPIN)
			vault.POST("", CreateCredential)
			vault.POST("/verify-otp", VerifyVaultOTP)
			vault.PUT("/:id", UpdateCredential)
			vault.DELETE("/:id", DeleteCredential)
		}
		
		// ---------------------------

		// Tax Compliance & GST Reports
		reports := api.Group("/reports")
		reports.Use(middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"))
		{
			reports.GET("/gst", GetGSTSummaryReport)
			reports.GET("/gst/export-csv", ExportGSTCSV)
			reports.GET("/gst/export-json", ExportGSTJSON)
			reports.GET("/gst/export-govt-json", ExportGSTR1GovtJSON)
		}

		// Double-Entry Financial Statements & Accounting
		financials := api.Group("/financials")
		financials.Use(middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"))
		{
			financials.GET("/profit-loss", GetProfitAndLoss)
			financials.GET("/balance-sheet", GetBalanceSheet)
			financials.GET("/trial-balance", GetTrialBalance)
			financials.GET("/accounts", GetAccountsList)
			financials.POST("/rebuild-journals", middleware.Authorize("SUDO_ADMIN"), RebuildJournalsHandler)
		}

		// Live Multi-Currency FX Rates
		fx := api.Group("/fx")
		{
			fx.GET("/rates", GetFXRates)
			fx.POST("/sync", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), SyncFXRatesHandler)
			fx.POST("/override", middleware.Authorize("SUDO_ADMIN", "ADMIN"), OverrideFXRateHandler)
		}

		// Dashboard
		api.GET("/dashboard", GetDashboard)
		api.GET("/dashboard/stats", GetDashboardStats)

		// Ledger
		api.GET("/ledger", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), GetLedger)
		api.GET("/ledger/pdf", middleware.Authorize("SUDO_ADMIN", "ADMIN", "ACCOUNTANT"), GetLedgerPDF)

		// Settings - software name is readable by all authenticated users
		api.GET("/settings/software-name", GetSoftwareName)
		api.GET("/settings/modules", GetActiveModules)

		// Settings - full management requires admin
		settings := api.Group("/settings")
		settings.Use(middleware.Authorize("SUDO_ADMIN", "ADMIN"))
		{
			settings.GET("", GetSettings)
			settings.GET("/:key", GetSetting)
			settings.POST("", UpsertSetting)
			settings.PUT("/sequence", UpdateSequence)
			settings.PUT("/:key", PutSetting)
			settings.PUT("/software-name", UpdateSoftwareName)
		}

		// Licensing & Safehouse Studios Serial Engine
		api.GET("/license/status", GetLicenseStatus)
		api.POST("/license/activate", middleware.Authorize("SUDO_ADMIN", "ADMIN"), ActivateLicense)
		api.DELETE("/license/deactivate", middleware.Authorize("SUDO_ADMIN", "ADMIN"), DeactivateLicense)

		// User Management
		users := api.Group("/users")
		users.Use(middleware.Authorize("SUDO_ADMIN", "ADMIN"))
		{
			users.GET("", ListUsers)
			users.POST("", CreateUser)
			users.PUT("/:id", UpdateUser)
			users.DELETE("/:id", DeleteUser)
		}

		// Profile
		api.GET("/profile", GetProfile)
		api.PUT("/profile", UpdateProfile)
		api.PUT("/profile/password", ChangePassword)

		// 2FA
		twofa := api.Group("/2fa")
		{
			twofa.POST("/generate", Generate2FA)
			twofa.POST("/enable", Enable2FA)
			twofa.POST("/disable", Disable2FA)
		}

		// Activity Logs — support both /activities and /activity (frontend uses /activity)
		api.GET("/activities", ListActivities)
		api.GET("/activity", ListActivities)

		// Notifications
		notifications := api.Group("/notifications")
		{
			notifications.GET("", ListNotifications)
			notifications.PATCH("/read-all", MarkAllNotificationsRead)
			notifications.PATCH("/:id/read", MarkNotificationRead)
			notifications.DELETE("/:id", DeleteNotification)
		}

		// Utilities — support both /states and /utils/states (frontend uses /utils/*)
		api.GET("/states", ListStates)
		api.GET("/countries", ListCountries)
		utils := api.Group("/utils")
		{
			utils.GET("/states", ListStates)
			utils.GET("/countries", ListCountries)
		}

		// File Upload
		api.POST("/upload", UploadFile)

		// Templates
		templates := api.Group("/templates")
		{
			templates.GET("/list", ListTemplates)
			templates.POST("/upload", UploadTemplate)
			templates.GET("/:name/export", ExportTemplate)
			templates.DELETE("/:name", DeleteTemplate)
			templates.PUT("/active", SetActiveTemplate)
			templates.GET("/:name/preview", PreviewTemplate)
		}

		// Mail
		mail := api.Group("/mail")
		{
			mail.GET("/config", GetMailConfig)
			mail.POST("/config", SaveMailConfig)
			mail.GET("/templates", GetMailTemplates)
			mail.POST("/templates", SaveMailTemplates)
			mail.POST("/test", SendTestEmail)
			mail.POST("/invoice/:id", SendInvoiceEmail)
			mail.POST("/quotation/:id", SendQuotationEmail)
		}

		// Backup (sudo admin only)
		backup := api.Group("/backup")
		backup.Use(middleware.Authorize("SUDO_ADMIN"))
		{
			backup.GET("/export", ExportBackup)
			backup.POST("/import", ImportBackup)
		}

		// Updater (sudo admin only)
		updater := api.Group("/updater")
		updater.Use(middleware.Authorize("SUDO_ADMIN"))
		{
			updater.GET("/check", CheckUpdate)
			updater.POST("/perform", PerformUpdate)
		}
	}
}

func healthCheck(c *gin.Context) {
	status := "ok"
	dbConnected := database.IsConnected()

	if !dbConnected {
		status = "awaiting_setup"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   status,
		"database": dbConnected,
		"version":  "2.0.0",
	})
}
