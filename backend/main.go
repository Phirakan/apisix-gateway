package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"apisix-backend/database"
	"apisix-backend/middleware"
	"apisix-backend/routes"

	"github.com/gofiber/fiber/v2"
)

func main() {
	// Initialize database
	log.Println("🚀 Starting GoFiber Backend Server...")
	
	// เชื่อมต่อ database
	dbConfig := database.GetConfigFromEnv()
	db, err := database.Connect(dbConfig)
	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}
	log.Println("✅ Database connected successfully")

	// Migrate database
	if err := database.Migrate(db); err != nil {
		log.Fatal("❌ Failed to migrate database:", err)
	}

	// Seed sample data (optional)
	if err := database.SeedData(db); err != nil {
		log.Printf("⚠️  Warning: Failed to seed sample data: %v", err)
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		Prefork:      false,
		ServerHeader: "GoFiber",
		AppName:      "APISIX Backend v1.0.0",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			
			// Log error
			log.Printf("❌ Error: %s - Path: %s - Method: %s", err.Error(), c.Path(), c.Method())
			
			return c.Status(code).JSON(fiber.Map{
				"error":      err.Error(),
				"status":     "error",
				"code":       code,
				"request_id": c.Locals("requestId"),
			})
		},
	})

	// Setup middleware
	middleware.SetupMiddleware(app)

	// Setup additional middleware if needed
	// เพิ่ม API key authentication ถ้าต้องการ
	// validAPIKeys := []string{"your-api-key-here"}
	// app.Use("/api/data", middleware.APIKeyAuth(validAPIKeys))

	// Security middleware
	app.Use(middleware.SecurityHeaders())
	app.Use(middleware.RequestID())
	app.Use(middleware.JSONOnly())
	app.Use(middleware.ValidateContentLength(10 * 1024 * 1024)) // 10MB limit

	// Setup routes
	routes.SetupRoutes(app, db)

	// Graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("🛑 Gracefully shutting down...")
		
		// Close database connection
		if err := database.Close(db); err != nil {
			log.Printf("❌ Error closing database: %v", err)
		} else {
			log.Println("✅ Database connection closed")
		}
		
		// Shutdown server
		if err := app.Shutdown(); err != nil {
			log.Printf("❌ Error shutting down server: %v", err)
		} else {
			log.Println("✅ Server shutdown complete")
		}
	}()

	// Start server
	port := getEnv("PORT", "3000")
	log.Printf("🌐 Server starting on port %s", port)
	log.Printf("📋 Available endpoints:")
	log.Printf("   Health Check: http://localhost:%s/api/health", port)
	log.Printf("   API Docs:     http://localhost:%s/", port)
	log.Printf("   Data API:     http://localhost:%s/api/data", port)
	
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("❌ Failed to start server:", err)
	}
}

// helper function สำหรับอ่านค่า environment variable
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}