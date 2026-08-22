package services

import (
	"crypto/tls"
	"fmt"
	"log"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
)

// StartScheduler begins the background boot-time and periodic checks
func StartScheduler() {
	go func() {
		// Run immediately on boot
		runScheduledTasks()

		// Then run every 6 hours
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			runScheduledTasks()
		}
	}()
}

func runScheduledTasks() {
	log.Println("🔄 Running Desktop Scheduler Tasks...")
	processRecurringInvoices()
	processRetainerInvoices()
	processSSLExpiryChecks()
}

func processRetainerInvoices() {
	var retainers []models.RetainerContract
	// Find all active retainers where NextRunDate is in the past or today
	database.DB.Where("status = ? AND (next_run_date IS NULL OR next_run_date <= ?)", "ACTIVE", time.Now()).Find(&retainers)

	for _, rt := range retainers {
		baseAmount := rt.MonthlyHours * rt.HourlyRate

		// 1. Calculate actual logged time in the past month for overage billing
		var timeEntries []models.TimeEntry
		lastBillingStart := time.Now().AddDate(0, -1, 0)
		database.DB.Where("contract_id = ? AND date >= ?", rt.ID, lastBillingStart).Find(&timeEntries)

		totalMinutesLogged := 0
		for _, te := range timeEntries {
			totalMinutesLogged += te.DurationMinutes
		}
		totalHoursLogged := float64(totalMinutesLogged) / 60.0

		// Line items
		lineItems := models.JSONArray{
			map[string]interface{}{
				"description": fmt.Sprintf("Monthly Retainer Base: %.1f budgeted hours", rt.MonthlyHours),
				"quantity":    1,
				"rate":        baseAmount,
				"amount":      baseAmount,
			},
		}

		subtotal := baseAmount

		// 2. Check for Overages
		if totalHoursLogged > rt.MonthlyHours && (rt.OverageHourlyRate > 0 || rt.HourlyRate > 0) {
			overageHours := totalHoursLogged - rt.MonthlyHours
			rate := rt.OverageHourlyRate
			if rate <= 0 {
				rate = rt.HourlyRate
			}
			overageCost := overageHours * rate
			subtotal += overageCost

			lineItems = append(lineItems, map[string]interface{}{
				"description": fmt.Sprintf("Retainer Overage: %.1f logged hours (over %.1f budget) @ %.2f/hr", overageHours, rt.MonthlyHours, rate),
				"quantity":    1,
				"rate":        overageCost,
				"amount":      overageCost,
			})
		}

		var issueDate time.Time
		if rt.NextRunDate != nil {
			issueDate = *rt.NextRunDate
		} else {
			issueDate = time.Now()
		}

		newInvoice := models.Invoice{
			ClientID:   rt.ClientID,
			Status:     "DRAFT", // Always create as draft for review
			IssueDate:  issueDate,
			Currency:   "INR",
			Category:   stringPtr("Software Agency Retainer"),
			LineItems:  lineItems,
			Subtotal:   subtotal,
			GrandTotal: subtotal,
		}

		if err := CreateInvoice(&newInvoice); err != nil {
			log.Printf("❌ Failed to create retainer invoice for Client %d: %v", rt.ClientID, err)
			continue
		}

		// Update the retainer next run date (add 1 month)
		var nextRun time.Time
		if rt.NextRunDate != nil {
			nextRun = rt.NextRunDate.AddDate(0, 1, 0)
		} else {
			nextRun = time.Now().AddDate(0, 1, 0)
		}

		now := time.Now()
		database.DB.Model(&rt).Updates(map[string]interface{}{
			"next_run_date": &nextRun,
			"last_run_date": &now,
		})

		log.Printf("✅ Generated Retainer Invoice %s for Client %d (Logged: %.1fh, Budget: %.1fh)", newInvoice.InvoiceNumber, rt.ClientID, totalHoursLogged, rt.MonthlyHours)
	}
}

func processRecurringInvoices() {
	var recurringInvoices []models.RecurringInvoice
	// Find all active recurring invoices where NextRunDate is in the past or today
	database.DB.Where("status = ? AND next_run_date <= ?", "ACTIVE", time.Now()).Find(&recurringInvoices)

	for _, ri := range recurringInvoices {
		newInvoice := models.Invoice{
			ClientID:       ri.ClientID,
			BankAccountID:  ri.BankAccountID,
			Status:         "DRAFT", // Always create as draft for review
			IssueDate:      ri.NextRunDate, // Backdate to the scheduled run date
			Currency:       ri.Currency,
			BaseCurrency:   ri.BaseCurrency,
			ExchangeRate:   ri.ExchangeRate,
			LineItems:      ri.LineItems,
			TaxSummary:     ri.TaxSummary,
			Subtotal:       ri.Subtotal,
			GrandTotal:     ri.GrandTotal,
			Category:       ri.Category,
			Remarks:        ri.Remarks,
			IsManualEntry:  false,
		}

		if err := CreateInvoice(&newInvoice); err != nil {
			log.Printf("❌ Failed to create recurring invoice for Client %d: %v", ri.ClientID, err)
			continue
		}

		// Update the recurring invoice next run date
		var nextRun time.Time
		if ri.Frequency == "MONTHLY" {
			nextRun = ri.NextRunDate.AddDate(0, 1, 0)
		} else if ri.Frequency == "YEARLY" {
			nextRun = ri.NextRunDate.AddDate(1, 0, 0)
		} else if ri.Frequency == "WEEKLY" {
			nextRun = ri.NextRunDate.AddDate(0, 0, 7)
		} else {
			nextRun = time.Now().AddDate(0, 1, 0) // Default to monthly
		}

		now := time.Now()
		database.DB.Model(&ri).Updates(map[string]interface{}{
			"next_run_date": nextRun,
			"last_run_date": &now,
		})

		log.Printf("✅ Generated Recurring Invoice %s for Client %d", newInvoice.InvoiceNumber, ri.ClientID)
	}
}

func processSSLExpiryChecks() {
	var domains []models.ClientDomain
	// Check all domains
	database.DB.Find(&domains)

	for _, d := range domains {
		expiry, issuer, err := getSSLDetails(d.DomainName)
		now := time.Now()

		updates := map[string]interface{}{
			"last_checked_at": &now,
		}

		var daysLeft int = 999
		if err == nil && expiry != nil {
			updates["has_ssl"] = true
			updates["ssl_issuer"] = issuer
			updates["ssl_expiry_date"] = expiry

			daysLeft = int(time.Until(*expiry).Hours() / 24)
			if daysLeft <= 0 {
				updates["ssl_status"] = "EXPIRED"
			} else if daysLeft <= 30 {
				updates["ssl_status"] = "EXPIRING_SOON"
			} else {
				updates["ssl_status"] = "VALID"
			}
		} else {
			updates["has_ssl"] = false
			updates["ssl_status"] = "NONE"
		}

		// Check Domain Expiration if provided
		if d.DomainExpiryDate != nil {
			domainDaysLeft := int(time.Until(*d.DomainExpiryDate).Hours() / 24)
			if domainDaysLeft < daysLeft {
				daysLeft = domainDaysLeft
			}
			if domainDaysLeft <= 0 {
				updates["status"] = "EXPIRED"
			} else if domainDaysLeft <= 30 {
				updates["status"] = "EXPIRING_SOON"
			} else {
				updates["status"] = "ACTIVE"
			}
		}

		database.DB.Model(&d).Updates(updates)

		// Dispatch Push & Webhook Alert for SSL expiring in <= 14 days
		if daysLeft <= 14 {
			DispatchAlert(AlertPayload{
				Type:      AlertEventSSLExpiring,
				Title:     fmt.Sprintf("🔒 SSL Expiry Warning: %s", d.DomainName),
				Message:   fmt.Sprintf("SSL certificate / domain registration for %s expires in %d days! Action required immediately.", d.DomainName, daysLeft),
				Severity:  "WARNING",
				Timestamp: now,
				Details: map[string]interface{}{
					"domain_name":    d.DomainName,
					"days_remaining": daysLeft,
					"ssl_status":     d.SSLStatus,
				},
			})
		}

		// Proactive Renewal Invoice & Notification (30 days prior)
		if daysLeft <= 30 && d.AutoRenew {
			// Check if we already created an invoice in the last 30 days
			shouldInvoice := true
			if d.LastInvoiceDate != nil && time.Since(*d.LastInvoiceDate) < 30*24*time.Hour {
				shouldInvoice = false
			}

			if shouldInvoice {
				renewalAmount := d.RenewalPrice
				if renewalAmount <= 0 {
					renewalAmount = 1500.0
				}

				lineItems := models.JSONArray{
					map[string]interface{}{
						"description": fmt.Sprintf("Annual Domain & SSL Certificate Renewal: %s (%d days remaining)", d.DomainName, daysLeft),
						"quantity":    1,
						"rate":        renewalAmount,
						"amount":      renewalAmount,
					},
				}

				dueDate := now.Add(15 * 24 * time.Hour)
				renewalInvoice := models.Invoice{
					ClientID:   d.ClientID,
					Status:     "DRAFT",
					IssueDate:  now,
					DueDate:    &dueDate,
					Currency:   "INR",
					Category:   stringPtr("Domain & Hosting"),
					LineItems:  lineItems,
					Subtotal:   renewalAmount,
					GrandTotal: renewalAmount,
				}

				if err := CreateInvoice(&renewalInvoice); err == nil {
					database.DB.Model(&d).Update("last_invoice_date", &now)
					log.Printf("🔔 Created Renewal Invoice %s for domain %s", renewalInvoice.InvoiceNumber, d.DomainName)

					// Notify Admins
					msg := fmt.Sprintf("Domain/SSL for %s expires in %d days. Draft renewal invoice %s generated.", d.DomainName, daysLeft, renewalInvoice.InvoiceNumber)
					database.DB.Create(&models.Notification{
						UserID:  1,
						Title:   fmt.Sprintf("Domain Renewal Alert: %s", d.DomainName),
						Message: &msg,
						Type:    "WARNING",
					})
				}
			}
		}
	}
}

func getSSLDetails(domain string) (*time.Time, string, error) {
	conn, err := tls.Dial("tcp", fmt.Sprintf("%s:443", domain), &tls.Config{
		InsecureSkipVerify: true,
	})
	if err != nil {
		return nil, "", err
	}
	defer conn.Close()

	certs := conn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return nil, "", fmt.Errorf("no certificates found")
	}

	expiry := certs[0].NotAfter
	issuer := certs[0].Issuer.CommonName
	return &expiry, issuer, nil
}

func stringPtr(s string) *string {
	return &s
}


