package handlers

import (
	"net/http"
	"strconv"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services/mqtt"
	"github.com/gin-gonic/gin"
)

// --- Printers ---

func ListPrinters(c *gin.Context) {
	var printers []models.Printer
	if err := database.DB.Find(&printers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch printers"})
		return
	}
	c.JSON(http.StatusOK, printers)
}

func CreatePrinter(c *gin.Context) {
	var input models.Printer
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.ConnectionType == "" {
		input.ConnectionType = "cloud"
	}
	if input.CloudRegion == "" {
		input.CloudRegion = "us"
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create printer"})
		return
	}

	// Trigger MQTT connection to Bambu Cloud / LAN
	go mqtt.ConnectPrinter(input)

	c.JSON(http.StatusCreated, input)
}

func UpdatePrinter(c *gin.Context) {
	id := c.Param("id")
	var printer models.Printer
	if err := database.DB.First(&printer, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Printer not found"})
		return
	}

	var input models.Printer
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	printer.Name = input.Name
	printer.Make = input.Make
	printer.ConnectionType = input.ConnectionType
	printer.CloudRegion = input.CloudRegion
	if input.CloudToken != "" {
		printer.CloudToken = input.CloudToken
	}
	if input.AccessCode != "" {
		printer.AccessCode = input.AccessCode
	}
	printer.SerialNumber = input.SerialNumber
	printer.IPAddress = input.IPAddress
	printer.Status = input.Status
	printer.HourlyRate = input.HourlyRate

	if err := database.DB.Save(&printer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update printer"})
		return
	}

	// Reconnect MQTT with updated configuration
	go mqtt.ConnectPrinter(printer)

	c.JSON(http.StatusOK, printer)
}

func DeletePrinter(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)

	// Clean up MQTT connection
	mqtt.DisconnectPrinter(id)

	if err := database.DB.Delete(&models.Printer{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete printer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Printer deleted successfully"})
}

// SyncPrinterMQTT forces a reconnection and status query for a printer
func SyncPrinterMQTT(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)

	var printer models.Printer
	if err := database.DB.First(&printer, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Printer not found"})
		return
	}

	mqtt.ConnectPrinter(printer)
	c.JSON(http.StatusOK, gin.H{"message": "MQTT synchronization triggered"})
}

// CommandPrinter sends control commands to a Bambu printer
func CommandPrinter(c *gin.Context) {
	idStr := c.Param("id")
	id, _ := strconv.Atoi(idStr)

	var req struct {
		Command string `json:"command" binding:"required"` // pause, resume, stop
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := mqtt.SendBambuCommand(id, req.Command); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Command sent successfully"})
}

// --- Filaments ---

func ListFilaments(c *gin.Context) {
	var filaments []models.Filament
	if err := database.DB.Order("created_at desc").Find(&filaments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch filaments"})
		return
	}
	c.JSON(http.StatusOK, filaments)
}

func CreateFilament(c *gin.Context) {
	var input models.Filament
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.InitialWeightGrams <= 0 {
		input.InitialWeightGrams = 1000
	}
	if input.RemainingWeightGrams <= 0 {
		input.RemainingWeightGrams = input.InitialWeightGrams
	}
	if input.CostPerGram <= 0 && input.SpoolPrice > 0 && input.InitialWeightGrams > 0 {
		input.CostPerGram = input.SpoolPrice / input.InitialWeightGrams
	}

	// Determine status
	if input.RemainingWeightGrams <= 0 {
		input.Status = "Depleted"
	} else if input.RemainingWeightGrams <= 150 {
		input.Status = "Low Stock"
	} else {
		input.Status = "In Stock"
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create filament"})
		return
	}
	c.JSON(http.StatusCreated, input)
}

func UpdateFilament(c *gin.Context) {
	id := c.Param("id")
	var filament models.Filament
	if err := database.DB.First(&filament, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Filament not found"})
		return
	}

	var input models.Filament
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	filament.Brand = input.Brand
	filament.MaterialType = input.MaterialType
	filament.Color = input.Color
	filament.ColorHex = input.ColorHex
	filament.InitialWeightGrams = input.InitialWeightGrams
	filament.RemainingWeightGrams = input.RemainingWeightGrams
	filament.SpoolPrice = input.SpoolPrice
	filament.CostPerGram = input.CostPerGram
	if filament.CostPerGram <= 0 && filament.SpoolPrice > 0 && filament.InitialWeightGrams > 0 {
		filament.CostPerGram = filament.SpoolPrice / filament.InitialWeightGrams
	}
	filament.Density = input.Density
	filament.DiameterMm = input.DiameterMm
	filament.Location = input.Location

	if filament.RemainingWeightGrams <= 0 {
		filament.Status = "Depleted"
	} else if filament.RemainingWeightGrams <= 150 {
		filament.Status = "Low Stock"
	} else {
		filament.Status = "In Stock"
	}

	if err := database.DB.Save(&filament).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update filament"})
		return
	}
	c.JSON(http.StatusOK, filament)
}

func AdjustFilamentWeight(c *gin.Context) {
	id := c.Param("id")
	var filament models.Filament
	if err := database.DB.First(&filament, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Filament not found"})
		return
	}

	var req struct {
		RemainingWeightGrams *float64 `json:"remaining_weight_grams"`
		DeductGrams          *float64 `json:"deduct_grams"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.RemainingWeightGrams != nil {
		filament.RemainingWeightGrams = *req.RemainingWeightGrams
	} else if req.DeductGrams != nil {
		filament.RemainingWeightGrams -= *req.DeductGrams
	}

	if filament.RemainingWeightGrams < 0 {
		filament.RemainingWeightGrams = 0
	}

	if filament.RemainingWeightGrams <= 0 {
		filament.Status = "Depleted"
	} else if filament.RemainingWeightGrams <= 150 {
		filament.Status = "Low Stock"
	} else {
		filament.Status = "In Stock"
	}

	if err := database.DB.Save(&filament).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to adjust filament weight"})
		return
	}

	c.JSON(http.StatusOK, filament)
}

func DeleteFilament(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Filament{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete filament"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Filament deleted successfully"})
}

// --- Print Jobs ---

func ListPrintJobs(c *gin.Context) {
	var jobs []models.PrintJob
	if err := database.DB.Preload("Printer").Preload("Filament").Preload("Client").Order("created_at desc").Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch print jobs"})
		return
	}
	c.JSON(http.StatusOK, jobs)
}

// calculateCost helper
func calculateTotalCost(weight float64, filament *models.Filament, hours float64, printer *models.Printer) float64 {
	var total float64 = 0
	if filament != nil && filament.CostPerGram > 0 {
		total += weight * filament.CostPerGram
	}
	if printer != nil && printer.HourlyRate > 0 {
		total += hours * printer.HourlyRate
	}
	return total
}

func CreatePrintJob(c *gin.Context) {
	var input models.PrintJob
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calculate Cost if printer/filament are provided
	var filament models.Filament
	var printer models.Printer

	if input.FilamentID != nil && *input.FilamentID > 0 {
		database.DB.First(&filament, *input.FilamentID)
	}
	if input.PrinterID != nil && *input.PrinterID > 0 {
		database.DB.First(&printer, *input.PrinterID)
	}

	input.TotalCost = calculateTotalCost(input.FilamentWeightGrams, &filament, input.EstimatedTimeHours, &printer)

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create print job"})
		return
	}

	// If created directly in "Done" status, deduct filament
	if input.Status == "Done" && input.FilamentID != nil && input.FilamentWeightGrams > 0 {
		deductFilamentInventory(*input.FilamentID, input.FilamentWeightGrams)
	}

	// Preload relations for client response
	database.DB.Preload("Printer").Preload("Filament").Preload("Client").First(&input, input.ID)

	c.JSON(http.StatusCreated, input)
}

func UpdatePrintJob(c *gin.Context) {
	id := c.Param("id")
	var job models.PrintJob
	if err := database.DB.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Print job not found"})
		return
	}

	oldStatus := job.Status

	var input models.PrintJob
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job.Title = input.Title
	job.Description = input.Description
	job.Status = input.Status
	job.PrinterID = input.PrinterID
	job.FilamentID = input.FilamentID
	job.EstimatedTimeHours = input.EstimatedTimeHours
	job.FilamentWeightGrams = input.FilamentWeightGrams
	job.ClientID = input.ClientID

	// Recalculate cost
	var filament models.Filament
	var printer models.Printer
	if job.FilamentID != nil && *job.FilamentID > 0 {
		database.DB.First(&filament, *job.FilamentID)
	}
	if job.PrinterID != nil && *job.PrinterID > 0 {
		database.DB.First(&printer, *job.PrinterID)
	}
	job.TotalCost = calculateTotalCost(job.FilamentWeightGrams, &filament, job.EstimatedTimeHours, &printer)

	if err := database.DB.Save(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update print job"})
		return
	}

	// If transitioning to Done for the first time, deduct inventory
	if oldStatus != "Done" && job.Status == "Done" && job.FilamentID != nil && job.FilamentWeightGrams > 0 {
		deductFilamentInventory(*job.FilamentID, job.FilamentWeightGrams)
	}

	database.DB.Preload("Printer").Preload("Filament").Preload("Client").First(&job, job.ID)
	c.JSON(http.StatusOK, job)
}

func UpdatePrintJobStatus(c *gin.Context) {
	id := c.Param("id")
	var job models.PrintJob
	if err := database.DB.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Print job not found"})
		return
	}

	oldStatus := job.Status

	var input struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job.Status = input.Status
	if err := database.DB.Save(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update print job status"})
		return
	}

	// Deduct filament when moved to Done
	if oldStatus != "Done" && job.Status == "Done" && job.FilamentID != nil && job.FilamentWeightGrams > 0 {
		deductFilamentInventory(*job.FilamentID, job.FilamentWeightGrams)
	}

	database.DB.Preload("Printer").Preload("Filament").Preload("Client").First(&job, job.ID)
	c.JSON(http.StatusOK, job)
}

// deductFilamentInventory reduces available spool weight
func deductFilamentInventory(filamentID int, grams float64) {
	var filament models.Filament
	if err := database.DB.First(&filament, filamentID).Error; err != nil {
		return
	}

	filament.RemainingWeightGrams -= grams
	if filament.RemainingWeightGrams < 0 {
		filament.RemainingWeightGrams = 0
	}

	if filament.RemainingWeightGrams <= 0 {
		filament.Status = "Depleted"
	} else if filament.RemainingWeightGrams <= 150 {
		filament.Status = "Low Stock"
	} else {
		filament.Status = "In Stock"
	}

	database.DB.Save(&filament)
}

func DeletePrintJob(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.PrintJob{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete print job"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Print job deleted successfully"})
}

