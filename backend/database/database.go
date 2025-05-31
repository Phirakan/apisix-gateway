package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"apisix-backend/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseConfig เก็บการตั้งค่า database
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

// GetConfigFromEnv อ่านการตั้งค่า database จาก environment variables
func GetConfigFromEnv() *DatabaseConfig {
	return &DatabaseConfig{
		Host:     getEnv("DB_HOST", "mariadb"),
		Port:     getEnv("DB_PORT", "3306"),
		User:     getEnv("DB_USER", "apisix_user"),
		Password: getEnv("DB_PASSWORD", "apisix_pass"),
		DBName:   getEnv("DB_NAME", "apisix_db"),
	}
}

// Connect สร้างการเชื่อมต่อกับ database
func Connect(config *DatabaseConfig) (*gorm.DB, error) {
	// สร้าง DSN (Data Source Name)
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		config.User, config.Password, config.Host, config.Port, config.DBName)

	log.Printf("Connecting to database at %s:%s", config.Host, config.Port)

	var db *gorm.DB
	var err error

	// ลองเชื่อมต่อหลายครั้ง (retry logic)
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		
		if err == nil {
			log.Println("Successfully connected to database")
			break
		}
		
		log.Printf("Failed to connect to database (attempt %d/%d): %v", i+1, maxRetries, err)
		time.Sleep(time.Second * 2)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after %d attempts: %w", maxRetries, err)
	}

	// ตั้งค่า connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// ตั้งค่า connection pool
	sqlDB.SetMaxIdleConns(10)           // จำนวน connection ที่เก็บไว้ในสถานะ idle
	sqlDB.SetMaxOpenConns(100)          // จำนวน connection สูงสุด
	sqlDB.SetConnMaxLifetime(time.Hour) // อายุของ connection

	return db, nil
}

// Migrate ทำการ migrate database schema
func Migrate(db *gorm.DB) error {
	log.Println("Starting database migration...")

	// Auto migrate models
	err := db.AutoMigrate(
		&models.Record{},
		// เพิ่ม models อื่นๆ ที่นี่ในอนาคต
	)

	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database migration completed successfully")
	return nil
}

// SeedData เพิ่มข้อมูลตัวอย่าง (optional)
func SeedData(db *gorm.DB) error {
	log.Println("Checking if sample data exists...")

	// ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
	var count int64
	db.Model(&models.Record{}).Count(&count)

	if count > 0 {
		log.Printf("Sample data already exists (%d records)", count)
		return nil
	}

	log.Println("Creating sample data...")

	// สร้างข้อมูลตัวอย่าง
	sampleRecords := []models.Record{
		{
			Name:  "Sample Record 1",
			Value: "This is the first sample record",
		},
		{
			Name:  "Sample Record 2",
			Value: "This is the second sample record",
		},
		{
			Name:  "Sample Record 3",
			Value: "This is the third sample record with more detailed information",
		},
		{
			Name:  "API Test Record",
			Value: "This record is for testing API functionality",
		},
		{
			Name:  "APISIX Integration",
			Value: "Testing APISIX gateway integration with GoFiber backend",
		},
	}

	// บันทึกข้อมูลตัวอย่าง
	if err := db.Create(&sampleRecords).Error; err != nil {
		return fmt.Errorf("failed to create sample data: %w", err)
	}

	log.Printf("Successfully created %d sample records", len(sampleRecords))
	return nil
}

// HealthCheck ตรวจสอบสถานะการเชื่อมต่อ database
func HealthCheck(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}

// Close ปิดการเชื่อมต่อ database
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	return sqlDB.Close()
}

// helper function สำหรับอ่านค่า environment variable
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}