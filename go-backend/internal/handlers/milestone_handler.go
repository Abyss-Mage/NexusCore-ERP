package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/anirban-guha/invoicecore/internal/database"
	"github.com/anirban-guha/invoicecore/internal/models"
	"github.com/anirban-guha/invoicecore/internal/services"
	"github.com/anirban-guha/invoicecore/internal/utils"
	"github.com/gin-gonic/gin"
)

type CreateProjectRequest struct {
	ClientID    int     `json:"client_id" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	TotalBudget float64 `json:"total_budget"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
	StartDate   *string `json:"start_date"`
	Deadline    *string `json:"deadline"`
}

type CreateMilestoneRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Amount      float64 `json:"amount" binding:"required"`
	Percentage  float64 `json:"percentage"`
	DueDate     *string `json:"due_date"`
	Status      string  `json:"status"`
}

// ListProjects returns software projects with client and milestone details
func ListProjects(c *gin.Context) {
	var projects []models.SoftwareProject
	query := database.DB.Preload("Client").Preload("Milestones").Order("created_at desc")

	if clientID := c.Query("client_id"); clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}

	if err := query.Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": projects})
}

// CreateProject creates a new software project
func CreateProject(c *gin.Context) {
	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	currency := "INR"
	if req.Currency != "" {
		currency = req.Currency
	}
	status := "IN_PROGRESS"
	if req.Status != "" {
		status = req.Status
	}

	var startDate, deadline *time.Time
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			startDate = &t
		}
	}
	if req.Deadline != nil && *req.Deadline != "" {
		if t, err := time.Parse("2006-01-02", *req.Deadline); err == nil {
			deadline = &t
		}
	}

	project := models.SoftwareProject{
		ClientID:    req.ClientID,
		Name:        req.Name,
		Description: req.Description,
		TotalBudget: req.TotalBudget,
		Currency:    currency,
		Status:      status,
		StartDate:   startDate,
		Deadline:    deadline,
	}

	if err := database.DB.Create(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project: " + err.Error()})
		return
	}

	database.DB.Preload("Client").First(&project, project.ID)
	c.JSON(http.StatusCreated, project)
}

// UpdateProject updates an existing project
func UpdateProject(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var project models.SoftwareProject

	if err := database.DB.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	project.ClientID = req.ClientID
	project.Name = req.Name
	project.Description = req.Description
	project.TotalBudget = req.TotalBudget
	if req.Currency != "" {
		project.Currency = req.Currency
	}
	if req.Status != "" {
		project.Status = req.Status
	}
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			project.StartDate = &t
		}
	}
	if req.Deadline != nil && *req.Deadline != "" {
		if t, err := time.Parse("2006-01-02", *req.Deadline); err == nil {
			project.Deadline = &t
		}
	}

	if err := database.DB.Save(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	c.JSON(http.StatusOK, project)
}

// DeleteProject deletes a project
func DeleteProject(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	database.DB.Where("project_id = ?", id).Delete(&models.ProjectMilestone{})
	if err := database.DB.Delete(&models.SoftwareProject{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

// CreateMilestone creates a milestone for a project
func CreateMilestone(c *gin.Context) {
	projectId, _ := strconv.Atoi(c.Param("projectId"))
	var project models.SoftwareProject
	if err := database.DB.First(&project, projectId).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var req CreateMilestoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	status := "PENDING"
	if req.Status != "" {
		status = req.Status
	}

	var dueDate *time.Time
	if req.DueDate != nil && *req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", *req.DueDate); err == nil {
			dueDate = &t
		}
	}

	milestone := models.ProjectMilestone{
		ProjectID:   projectId,
		Title:       req.Title,
		Description: req.Description,
		Amount:      req.Amount,
		Percentage:  req.Percentage,
		DueDate:     dueDate,
		Status:      status,
	}

	if err := database.DB.Create(&milestone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add milestone"})
		return
	}

	c.JSON(http.StatusCreated, milestone)
}

// UpdateMilestone updates a milestone
func UpdateMilestone(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var milestone models.ProjectMilestone

	if err := database.DB.First(&milestone, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Milestone not found"})
		return
	}

	var req CreateMilestoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	milestone.Title = req.Title
	milestone.Description = req.Description
	milestone.Amount = req.Amount
	milestone.Percentage = req.Percentage
	if req.Status != "" {
		milestone.Status = req.Status
	}
	if req.DueDate != nil && *req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", *req.DueDate); err == nil {
			milestone.DueDate = &t
		}
	}

	if err := database.DB.Save(&milestone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update milestone"})
		return
	}

	c.JSON(http.StatusOK, milestone)
}

// DeleteMilestone removes a milestone
func DeleteMilestone(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.DB.Delete(&models.ProjectMilestone{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete milestone"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Milestone deleted successfully"})
}

// CompleteAndInvoiceMilestone marks milestone completed and generates draft invoice
func CompleteAndInvoiceMilestone(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var milestone models.ProjectMilestone

	if err := database.DB.Preload("Project").First(&milestone, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Milestone not found"})
		return
	}

	if milestone.Status == "INVOICED" && milestone.InvoiceID != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Milestone already invoiced"})
		return
	}

	var bank models.BankAccount
	var bankID *int
	if err := database.DB.First(&bank).Error; err == nil {
		bankID = &bank.ID
	}

	lineItems := models.JSONArray{
		map[string]interface{}{
			"description": fmt.Sprintf("Project Milestone: %s (%s)", milestone.Title, milestone.Project.Name),
			"quantity":    1,
			"rate":        milestone.Amount,
			"amount":      milestone.Amount,
		},
	}

	now := time.Now()
	dueDate := now.Add(15 * 24 * time.Hour)

	newInvoice := models.Invoice{
		ClientID:      milestone.Project.ClientID,
		BankAccountID: bankID,
		Status:        "DRAFT",
		IssueDate:     now,
		DueDate:       &dueDate,
		Currency:      milestone.Project.Currency,
		Category:      utils.StringPtr("Software Development"),
		LineItems:     lineItems,
		Subtotal:      milestone.Amount,
		GrandTotal:    milestone.Amount,
		IsManualEntry: false,
	}

	if err := services.CreateInvoice(&newInvoice); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create milestone invoice: " + err.Error()})
		return
	}

	milestone.Status = "INVOICED"
	milestone.InvoiceID = &newInvoice.ID
	database.DB.Save(&milestone)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Milestone completed and invoice %s generated", newInvoice.InvoiceNumber),
		"invoice": newInvoice,
		"milestone": milestone,
	})
}
