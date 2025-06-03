// backend/main.go (Updated)
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"apisix-backend/config"
	"apisix-backend/database"
	"apisix-backend/middleware"
	"apisix-backend/routes"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg := config.Load()
	
	log.Println("🚀 Starting APISIX GoFiber Backend Server with Route Management...")
	log.Printf("📋 Environment: %s", cfg.Server.Environment)
	
	// Validate configuration
	if errors := cfg.Validate(); len(errors) > 0 {
		log.Fatal("❌ Configuration validation failed:", errors)
	}
	
	// เพิ่มการรอ MariaDB ให้พร้อม
	log.Println("⏳ Waiting for MariaDB to be ready...")
	time.Sleep(10 * time.Second) // รอ MariaDB เริ่มต้น
	
	// Connect to database with retry
	log.Println("🗄️  Connecting to MariaDB...")
	dbConfig := &database.DatabaseConfig{
		Host:     cfg.Database.Host,
		Port:     cfg.Database.Port,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		DBName:   cfg.Database.DBName,
	}
	
	var db *gorm.DB
	var err error
	
	// Retry connection to database
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		db, err = database.Connect(dbConfig)
		if err == nil {
			log.Println("✅ Database connected successfully")
			break
		}
		
		log.Printf("⚠️  Database connection attempt %d/%d failed: %v", i+1, maxRetries, err)
		if i < maxRetries-1 {
			log.Println("🔄 Retrying in 3 seconds...")
			time.Sleep(3 * time.Second)
		}
	}
	
	if err != nil {
		log.Fatalf("❌ Failed to connect to database after %d attempts: %v", maxRetries, err)
	}

	// Run migrations
	log.Println("📦 Running database migrations...")
	if err := database.Migrate(db); err != nil {
		log.Fatal("❌ Failed to migrate database:", err)
	}
	log.Println("✅ Database migrations completed")
	
	// Seed sample data if enabled
	if cfg.Features.EnableSampleData {
		log.Println("🌱 Seeding sample data...")
		if err := database.SeedData(db); err != nil {
			log.Printf("⚠️  Warning: Failed to seed sample data: %v", err)
		} else {
			log.Println("✅ Sample data seeded successfully")
		}
	}

	// Validate route management configuration
	log.Println("🔧 Checking route management configuration...")
	routeConfigPath := os.Getenv("ROUTE_CONFIG_PATH")
	if routeConfigPath == "" {
		routeConfigPath = "/app/apisix.yaml" // Default path
	}
	
	// Check if apisix.yaml file exists and is accessible
	if _, err := os.Stat(routeConfigPath); err != nil {
		log.Printf("⚠️  Warning: Route config file not found at %s: %v", routeConfigPath, err)
		log.Println("📝 Route management will use fallback configuration")
	} else {
		log.Printf("✅ Route config file found at %s", routeConfigPath)
		log.Println("🎯 Dynamic route management enabled")
	}

	// Create Fiber app with optimized configuration
	app := fiber.New(fiber.Config{
		Prefork:               cfg.Server.Prefork,
		ServerHeader:          "GoFiber APISIX Backend with Route Management",
		AppName:               "APISIX Backend with Route Management v2.0.0",
		BodyLimit:             int(cfg.Security.MaxRequestSize),
		ReadTimeout:           time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout:          time.Duration(cfg.Server.WriteTimeout) * time.Second,
		IdleTimeout:           time.Second * 30,
		DisableStartupMessage: false,
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
				"timestamp":  time.Now().Format(time.RFC3339),
			})
		},
	})

	// Setup middleware
	log.Println("🔧 Setting up middleware...")
	middleware.SetupMiddleware(app)
	
	// Additional security middleware
	app.Use(middleware.SecurityHeaders())
	app.Use(middleware.RequestID())
	app.Use(middleware.JSONOnly())
	app.Use(middleware.ValidateContentLength(cfg.Security.MaxRequestSize))
	
	// Setup API key authentication if enabled (but exclude route management endpoints)
	if cfg.Security.EnableAPIKeyAuth && len(cfg.Security.APIKeys) > 0 {
		app.Use("/api/data", middleware.APIKeyAuth(cfg.Security.APIKeys))
		log.Printf("🔒 API Key authentication enabled for /api/data endpoints")
		log.Printf("📝 Route management endpoints are accessible without API key for development")
	}

	// Setup routes (including route management)
	log.Println("🛣️  Setting up routes...")
	routes.SetupRoutes(app, db)
	log.Println("✅ Routes configured successfully")
	log.Println("🎯 Route management endpoints available:")
	log.Println("   - GET    /api/routes (list all routes)")
	log.Println("   - POST   /api/routes (create route)")
	log.Println("   - GET    /api/routes/:id (get route by ID)")
	log.Println("   - PUT    /api/routes/:id (update route)")
	log.Println("   - DELETE /api/routes/:id (delete route)")
	log.Println("   - POST   /api/routes/quick (quick route creation)")
	log.Println("   - GET    /api/routes/templates (get templates)")
	log.Println("   - POST   /api/routes/reload (reload APISIX)")

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
	log.Printf("   Health Check:       http://%s/api/health", address)
	log.Printf("   API Docs:           http://%s/", address)
	log.Printf("   Data API:           http://%s/api/data", address)
	log.Printf("   Route Management:   http://%s/api/routes", address)
	log.Printf("   Upstreams:          http://%s/api/upstreams", address)
	log.Printf("   Dashboard:          http://localhost:5173")
	log.Println("")
	log.Println("🎉 GoFiber backend with Route Management ready!")
	log.Println("💡 Use the React Dashboard to manage APISIX routes dynamically")
	
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