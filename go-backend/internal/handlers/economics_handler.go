package handlers

import (
	"math"
	"net/http"
	"sort"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/gin-gonic/gin"
)

type PrinterEconomics struct {
	PrinterID        int     `json:"printer_id"`
	Name             string  `json:"name"`
	Make             string  `json:"make"`
	PurchasePrice    float64 `json:"purchase_price"`
	TotalJobs        int     `json:"total_jobs"`
	TotalPrintHours  float64 `json:"total_print_hours"`
	PowerConsumedKwh float64 `json:"power_consumed_kwh"`
	DepreciationCost float64 `json:"depreciation_cost"`
	ElectricityCost  float64 `json:"electricity_cost"`
	FilamentCost     float64 `json:"filament_cost"`
	LaborCost        float64 `json:"labor_cost"`
	TotalCost        float64 `json:"total_cost"`
	TotalRevenue     float64 `json:"total_revenue"`
	NetProfit        float64 `json:"net_profit"`
	MarginPercent    float64 `json:"margin_percent"`
	ROIPercent       float64 `json:"roi_percent"`
}

type MaterialEconomics struct {
	MaterialType  string  `json:"material_type"`
	TotalGrams    float64 `json:"total_grams"`
	TotalJobs     int     `json:"total_jobs"`
	MaterialCost  float64 `json:"material_cost"`
	TotalRevenue  float64 `json:"total_revenue"`
	NetProfit     float64 `json:"net_profit"`
	MarginPercent float64 `json:"margin_percent"`
}

type ClientEconomics struct {
	ClientID      int     `json:"client_id"`
	ClientName    string  `json:"client_name"`
	TotalJobs     int     `json:"total_jobs"`
	TotalRevenue  float64 `json:"total_revenue"`
	TotalCost     float64 `json:"total_cost"`
	NetProfit     float64 `json:"net_profit"`
	MarginPercent float64 `json:"margin_percent"`
}

type UnitEconomicsSummary struct {
	TotalJobs             int                  `json:"total_jobs"`
	TotalPrintHours       float64              `json:"total_print_hours"`
	TotalFilamentGrams    float64              `json:"total_filament_grams"`
	TotalRevenue          float64              `json:"total_revenue"`
	TotalFilamentCost     float64              `json:"total_filament_cost"`
	TotalDepreciationCost float64              `json:"total_depreciation_cost"`
	TotalElectricityCost  float64              `json:"total_electricity_cost"`
	TotalLaborCost        float64              `json:"total_labor_cost"`
	TotalCost             float64              `json:"total_cost"`
	TotalNetProfit        float64              `json:"total_net_profit"`
	AverageMarginPercent  float64              `json:"average_margin_percent"`
	ByPrinter             []PrinterEconomics   `json:"by_printer"`
	ByMaterial            []MaterialEconomics  `json:"by_material"`
	ByClient              []ClientEconomics    `json:"by_client"`
	RecentJobs            []models.PrintJob    `json:"recent_jobs"`
}

// GetUnitEconomicsAnalytics aggregates full job costing and ROI metrics
func GetUnitEconomicsAnalytics(c *gin.Context) {
	var jobs []models.PrintJob
	database.DB.Preload("Printer").Preload("Filament").Preload("Client").Order("created_at desc").Find(&jobs)

	var printers []models.Printer
	database.DB.Find(&printers)

	printerMap := make(map[int]*PrinterEconomics)
	for _, p := range printers {
		price := p.PurchasePrice
		if price <= 0 {
			price = 120000.0 // Default 3D printer capex
		}
		printerMap[p.ID] = &PrinterEconomics{
			PrinterID:     p.ID,
			Name:          p.Name,
			Make:          p.Make,
			PurchasePrice: price,
		}
	}

	materialMap := make(map[string]*MaterialEconomics)
	clientMap := make(map[int]*ClientEconomics)

	var summary UnitEconomicsSummary

	for i := range jobs {
		job := &jobs[i]

		// 1. Calculate granular cost components if not fully persisted
		filamentCostPerGram := 1.50
		if job.Filament != nil && job.Filament.CostPerGram > 0 {
			filamentCostPerGram = job.Filament.CostPerGram
		}
		filCost := job.FilamentWeightGrams * filamentCostPerGram

		powerWatts := 350.0
		powerRate := 8.50
		depreciationRate := 24.0 // 120,000 / 5,000 hrs
		laborRate := 250.0

		if job.Printer != nil {
			if job.Printer.PowerWatts > 0 {
				powerWatts = job.Printer.PowerWatts
			}
			if job.Printer.ElectricityRatePerKwh > 0 {
				powerRate = job.Printer.ElectricityRatePerKwh
			}
			if job.Printer.PurchasePrice > 0 && job.Printer.LifespanHours > 0 {
				depreciationRate = job.Printer.PurchasePrice / job.Printer.LifespanHours
			}
			if job.Printer.LaborRatePerHour > 0 {
				laborRate = job.Printer.LaborRatePerHour
			}
		}

		depCost := job.EstimatedTimeHours * depreciationRate
		kwh := (powerWatts / 1000.0) * job.EstimatedTimeHours
		elecCost := kwh * powerRate

		laborHrs := job.LaborHours
		if laborHrs <= 0 {
			laborHrs = 0.25 // Default 15 mins prep/post-processing
		}
		labCost := laborHrs * laborRate

		totCost := filCost + depCost + elecCost + labCost

		rev := job.Revenue
		if rev <= 0 {
			if job.TotalCost > 0 {
				rev = job.TotalCost // Backwards compatible billed rate
			} else {
				rev = (job.EstimatedTimeHours * 200.0) + (job.FilamentWeightGrams * 3.5)
			}
		}

		netProf := rev - totCost
		var marginPct float64
		if rev > 0 {
			marginPct = (netProf / rev) * 100.0
		}

		job.FilamentCost = filCost
		job.DepreciationCost = depCost
		job.ElectricityCost = elecCost
		job.LaborCost = labCost
		job.TotalCost = totCost
		job.Revenue = rev
		job.NetProfit = netProf
		job.NetMarginPercent = marginPct

		// Aggregate fleet totals
		summary.TotalJobs++
		summary.TotalPrintHours += job.EstimatedTimeHours
		summary.TotalFilamentGrams += job.FilamentWeightGrams
		summary.TotalFilamentCost += filCost
		summary.TotalDepreciationCost += depCost
		summary.TotalElectricityCost += elecCost
		summary.TotalLaborCost += labCost
		summary.TotalCost += totCost
		summary.TotalRevenue += rev
		summary.TotalNetProfit += netProf

		// Aggregate by Printer
		if job.PrinterID != nil {
			pID := *job.PrinterID
			pe, exists := printerMap[pID]
			if !exists {
				name := "Unknown Printer"
				if job.Printer != nil {
					name = job.Printer.Name
				}
				pe = &PrinterEconomics{
					PrinterID:     pID,
					Name:          name,
					PurchasePrice: 120000.0,
				}
				printerMap[pID] = pe
			}
			pe.TotalJobs++
			pe.TotalPrintHours += job.EstimatedTimeHours
			pe.PowerConsumedKwh += kwh
			pe.DepreciationCost += depCost
			pe.ElectricityCost += elecCost
			pe.FilamentCost += filCost
			pe.LaborCost += labCost
			pe.TotalCost += totCost
			pe.TotalRevenue += rev
			pe.NetProfit += netProf
		}

		// Aggregate by Material Type
		matType := "PLA"
		if job.Filament != nil && job.Filament.MaterialType != "" {
			matType = job.Filament.MaterialType
		}
		me, exists := materialMap[matType]
		if !exists {
			me = &MaterialEconomics{MaterialType: matType}
			materialMap[matType] = me
		}
		me.TotalJobs++
		me.TotalGrams += job.FilamentWeightGrams
		me.MaterialCost += filCost
		me.TotalRevenue += rev
		me.NetProfit += netProf

		// Aggregate by Client
		cID := 0
		cName := "Direct Sale / Internal"
		if job.ClientID != nil {
			cID = *job.ClientID
			if job.Client != nil {
				cName = job.Client.CompanyName
			}
		}
		ce, exists := clientMap[cID]
		if !exists {
			ce = &ClientEconomics{
				ClientID:   cID,
				ClientName: cName,
			}
			clientMap[cID] = ce
		}
		ce.TotalJobs++
		ce.TotalRevenue += rev
		ce.TotalCost += totCost
		ce.NetProfit += netProf
	}

	if summary.TotalRevenue > 0 {
		summary.AverageMarginPercent = (summary.TotalNetProfit / summary.TotalRevenue) * 100.0
	}

	// Finalize Printer ROI & Margins
	for _, pe := range printerMap {
		if pe.TotalRevenue > 0 {
			pe.MarginPercent = (pe.NetProfit / pe.TotalRevenue) * 100.0
		}
		if pe.PurchasePrice > 0 {
			pe.ROIPercent = (pe.NetProfit / pe.PurchasePrice) * 100.0
		}
		summary.ByPrinter = append(summary.ByPrinter, *pe)
	}
	sort.Slice(summary.ByPrinter, func(i, j int) bool {
		return summary.ByPrinter[i].NetProfit > summary.ByPrinter[j].NetProfit
	})

	// Finalize Material Margins
	for _, me := range materialMap {
		if me.TotalRevenue > 0 {
			me.MarginPercent = (me.NetProfit / me.TotalRevenue) * 100.0
		}
		summary.ByMaterial = append(summary.ByMaterial, *me)
	}
	sort.Slice(summary.ByMaterial, func(i, j int) bool {
		return summary.ByMaterial[i].TotalGrams > summary.ByMaterial[j].TotalGrams
	})

	// Finalize Client Margins
	for _, ce := range clientMap {
		if ce.TotalRevenue > 0 {
			ce.MarginPercent = (ce.NetProfit / ce.TotalRevenue) * 100.0
		}
		summary.ByClient = append(summary.ByClient, *ce)
	}
	sort.Slice(summary.ByClient, func(i, j int) bool {
		return summary.ByClient[i].TotalRevenue > summary.ByClient[j].TotalRevenue
	})

	limit := 15
	if len(jobs) < limit {
		limit = len(jobs)
	}
	summary.RecentJobs = jobs[:limit]

	// Round numbers for clean output
	summary.TotalPrintHours = math.Round(summary.TotalPrintHours*100) / 100
	summary.TotalFilamentGrams = math.Round(summary.TotalFilamentGrams*100) / 100
	summary.TotalRevenue = math.Round(summary.TotalRevenue*100) / 100
	summary.TotalCost = math.Round(summary.TotalCost*100) / 100
	summary.TotalNetProfit = math.Round(summary.TotalNetProfit*100) / 100
	summary.AverageMarginPercent = math.Round(summary.AverageMarginPercent*10) / 10

	c.JSON(http.StatusOK, gin.H{"data": summary})
}
