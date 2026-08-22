package services

import (
	"testing"
)

func TestCalculateTax_NoDB(t *testing.T) {
	// When DB is not initialized in unit test, should return NONE tax
	result := CalculateTax(10000.0)

	if result.TaxType != "NONE" {
		t.Errorf("Expected NONE when no DB, got %s", result.TaxType)
	}
	if result.Amount != 0 {
		t.Errorf("Expected 0 amount, got %f", result.Amount)
	}
}
