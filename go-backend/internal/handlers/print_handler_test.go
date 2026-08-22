package handlers

import (
	"testing"
	"github.com/anirban-guha/invoicecore/internal/models"
)

func TestCalculateTotalCost(t *testing.T) {
	tests := []struct {
		name     string
		weight   float64
		filament *models.Filament
		hours    float64
		printer  *models.Printer
		expected float64
	}{
		{
			name:   "Both printer and filament used",
			weight: 100,
			filament: &models.Filament{
				CostPerGram: 0.05,
			},
			hours: 5.5,
			printer: &models.Printer{
				HourlyRate: 2.00,
			},
			expected: (100 * 0.05) + (5.5 * 2.00), // 5 + 11 = 16
		},
		{
			name:   "Only filament used",
			weight: 200,
			filament: &models.Filament{
				CostPerGram: 0.03,
			},
			hours:    0,
			printer:  nil,
			expected: 6.0,
		},
		{
			name:     "Only printer used",
			weight:   0,
			filament: nil,
			hours:    10,
			printer: &models.Printer{
				HourlyRate: 1.50,
			},
			expected: 15.0,
		},
		{
			name:     "Neither used",
			weight:   0,
			filament: nil,
			hours:    0,
			printer:  nil,
			expected: 0.0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := calculateTotalCost(tc.weight, tc.filament, tc.hours, tc.printer)
			if result != tc.expected {
				t.Errorf("Expected %f, got %f", tc.expected, result)
			}
		})
	}
}
