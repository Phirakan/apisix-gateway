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
	// สร้าง DSN (Data Source Name) with additional parameters
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local&timeout=30s&readTimeout=30s&writeTimeout=30s",
		config.User, config.Password, config.Host, config.Port, config.DBName)

	log.Printf("Attempting to connect to database at %s:%s", config.Host, config.Port)

	var db *gorm.DB
	var err error

	// ปรับ retry logic ให้มีประสิทธิภาพมากขึ้น
	maxRetries := 15
	baseDelay := 2 * time.Second
	
	for i := 0; i < maxRetries; i++ {
		// สร้าง GORM config ที่เหมาะสม
		gormConfig := &gorm.Config{
			Logger: logger.New(
				log.New(os.Stdout, "\r\n", log.LstdFlags),
				logger.Config{
					SlowThreshold:             time.Second,
					LogLevel:                  logger.Info,
					IgnoreRecordNotFoundError: false,
					Colorful:                  true,
				},
			),
			DisableForeignKeyConstraintWhenMigrating: true,
			PrepareStmt:                              true,
		}
		
		db, err = gorm.Open(mysql.Open(dsn), gormConfig)
		
		if err == nil {
			// ทดสอบการเชื่อมต่อจริง
			sqlDB, sqlErr := db.DB()
			if sqlErr == nil {
				if pingErr := sqlDB.Ping(); pingErr == nil {
					log.Println("✅ Successfully connected to database")
					
					// ตั้งค่า connection pool ที่เหมาะสม
					sqlDB.SetMaxIdleConns(5)            // ลดจาก 10
					sqlDB.SetMaxOpenConns(20)           // ลดจาก 100
					sqlDB.SetConnMaxLifetime(time.Hour) // 1 ชั่วโมง
					sqlDB.SetConnMaxIdleTime(10 * time.Minute) // 10 นาที
					
					return db, nil
				} else {
					err = fmt.Errorf("ping failed: %w", pingErr)
				}
			} else {
				err = fmt.Errorf("failed to get SQL DB: %w", sqlErr)
			}
		}
		
		// คำนวณ delay แบบ exponential backoff
		delay := baseDelay * time.Duration(i+1)
		if delay > 10*time.Second {
			delay = 10 * time.Second
		}
		
		log.Printf("⚠️  Connection attempt %d/%d failed: %v", i+1, maxRetries, err)
		
		if i < maxRetries-1 {
			log.Printf("🔄 Retrying in %v...", delay)
			time.Sleep(delay)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after %d attempts: %w", maxRetries, err)
	}

	return db, nil
}

// Migrate ทำการ migrate database schema
func Migrate(db *gorm.DB) error {
	log.Println("Starting database migration...")

	// ใช้ migrate mode แบบ safe
	migrator := db.Migrator()
	
	// ตรวจสอบว่าตาราง records มีอยู่หรือไม่
	if !migrator.HasTable(&models.Record{}) {
		log.Println("Creating records table...")
	} else {
		log.Println("Records table already exists, checking for updates...")
	}

	// Auto migrate models
	err := db.AutoMigrate(
		&models.Record{},
		// เพิ่ม models อื่นๆ ที่นี่ในอนาคต
	)

	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("✅ Database migration completed successfully")
	return nil
}

// SeedData เพิ่มข้อมูลตัวอย่าง (optional)
func SeedData(db *gorm.DB) error {
	log.Println("Checking if sample data exists...")

	// ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
	var count int64
	result := db.Model(&models.Record{}).Count(&count)
	if result.Error != nil {
		return fmt.Errorf("failed to count records: %w", result.Error)
	}

	if count > 0 {
		log.Printf("Sample data already exists (%d records)", count)
		return nil
	}

	log.Println("Creating sample data...")

	// สร้างข้อมูลตัวอย่าง
	sampleRecords := []models.Record{
		{
			Name:  "Sample Record 1",
			Value: "This is the first sample record for testing APISIX integration",
		},
		{
			Name:  "Sample Record 2",
			Value: "This is the second sample record with more detailed information",
		},
		{
			Name:  "API Test Record",
			Value: "This record is specifically for testing API functionality through APISIX gateway",
		},
		{
			Name:  "APISIX Integration Test",
			Value: "Testing APISIX gateway integration with GoFiber backend and MariaDB database",
		},
		{
			Name:  "Health Check Data",
			Value: "Sample data to verify that the health check endpoint is working correctly",
		},
	}

	// บันทึกข้อมูลตัวอย่างแบบ batch
	result = db.CreateInBatches(&sampleRecords, 100)
	if result.Error != nil {
		return fmt.Errorf("failed to create sample data: %w", result.Error)
	}

	log.Printf("✅ Successfully created %d sample records", len(sampleRecords))
	return nil
}

// HealthCheck ตรวจสอบสถานะการเชื่อมต่อ database
func HealthCheck(db *gorm.DB) error {
	// ทดสอบการเชื่อมต่อ
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL DB: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	// ทดสอบ query ธรรมดา
	var result int
	if err := db.Raw("SELECT 1").Scan(&result).Error; err != nil {
		return fmt.Errorf("database query test failed: %w", err)
	}

	return nil
}

// Close ปิดการเชื่อมต่อ database
func Close(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL DB: %w", err)
	}

	if err := sqlDB.Close(); err != nil {
		return fmt.Errorf("failed to close database: %w", err)
	}
	
	log.Println("Database connection closed successfully")
	return nil
}

// helper function สำหรับอ่านค่า environment variable
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}