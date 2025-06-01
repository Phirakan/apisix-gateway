package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"apisix-backend/config"
	"apisix-backend/database"
	"apisix-backend/middleware"
	"apisix-backend/routes"

	"github.com/gofiber/fiber/v2"
)

func main() {
	// Load configuration
	cfg := config.Load()
	
	log.Println("🚀 Starting APISIX GoFiber Backend Server...")
	log.Printf("📋 Environment: %s", cfg.Server.Environment)
	
	// Validate configuration
	if errors := cfg.Validate(); len(errors) > 0 {
		log.Fatal("❌ Configuration validation failed:", errors)
	}
	
	// Connect to database
	log.Println("🗄️  Connecting to MariaDB...")
	dbConfig := &database.DatabaseConfig{
		Host:     cfg.Database.Host,
		Port:     cfg.Database.Port,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		DBName:   cfg.Database.DBName,
	}
	
	db, err := database.Connect(dbConfig)
	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}
	log.Println("✅ Database connected successfully")

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatal("❌ Failed to migrate database:", err)
	}
	
	// Seed sample data if enabled
	if cfg.Features.EnableSampleData {
		if err := database.SeedData(db); err != nil {
			log.Printf("⚠️  Warning: Failed to seed sample data: %v", err)
		}
	}

	// Create Fiber app with configuration
	app := fiber.New(fiber.Config{
		Prefork:      cfg.Server.Prefork,
		ServerHeader: "GoFiber APISIX Backend",
		AppName:      "APISIX Backend v1.0.0",
		BodyLimit:    int(cfg.Security.MaxRequestSize),
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			
			log.Printf("❌ Error [%d]: %s - Path: %s - Method: %s - IP: %s", 
				code, err.Error(), c.Path(), c.Method(), c.IP())
			
			return c.Status(code).JSON(fiber.Map{
				"error":      err.Error(),
				"status":     "error",
				"code":       code,
				"request_id": c.Locals("requestId"),
				"timestamp":  c.Response().Header.Peek("Date"),
			})
		},
	})

	// Setup middleware
	middleware.SetupMiddleware(app)
	
	// Additional security middleware
	app.Use(middleware.SecurityHeaders())
	app.Use(middleware.RequestID())
	app.Use(middleware.JSONOnly())
	app.Use(middleware.ValidateContentLength(cfg.Security.MaxRequestSize))
	
	// Setup API key authentication if enabled
	if cfg.Security.EnableAPIKeyAuth && len(cfg.Security.APIKeys) > 0 {
		app.Use("/api/data", middleware.APIKeyAuth(cfg.Security.APIKeys))
		log.Printf("🔒 API Key authentication enabled for /api/data endpoints")
	}

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
	address := cfg.GetServerAddress()
	log.Printf("🌐 Server starting on http://%s", address)
	log.Printf("📋 Available endpoints:")
	log.Printf("   Health Check: http://%s/api/health", address)
	log.Printf("   API Docs:     http://%s/", address)
	log.Printf("   Data API:     http://%s/api/data", address)
	
	if cfg.Security.EnableHTTPS {
		log.Printf("🔒 HTTPS enabled")
		if err := app.ListenTLS(":"+cfg.Server.Port, cfg.Security.CertFile, cfg.Security.KeyFile); err != nil {
			log.Fatal("❌ Failed to start HTTPS server:", err)
		}
	} else {
		if err := app.Listen(":" + cfg.Server.Port); err != nil {
			log.Fatal("❌ Failed to start server:", err)
		}
	}
}