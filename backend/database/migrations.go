package database

import (
	"log"

	"apisix-backend/models"
	"gorm.io/gorm"
)

// MigrateAPIKeyTables runs migrations for API key related tables
func MigrateAPIKeyTables(db *gorm.DB) error {
	log.Println("🔄 Running API key table migrations...")

	// Auto migrate API key table
	err := db.AutoMigrate(&models.APIKey{})
	if err != nil {
		return err
	}

	log.Println("✅ API key table migrations completed")
	return nil
}