package main

import (
	"log"
	"os"

	"github.com/anirban-guha/invoicecore/cmd/server"
)

func main() {
	// Handle CLI flags
	if len(os.Args) >= 3 && os.Args[1] == "--export-backup" {
		backupPath := os.Args[2]
		err := server.ExportBackupCLI(backupPath)
		if err != nil {
			log.Fatalf("Failed to export backup: %v", err)
		}
		log.Printf("Successfully exported backup to %s", backupPath)
		return
	}

	// Start the backend API server (blocking)
	server.Start()
}
