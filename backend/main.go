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
	"apisix-backend/service"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg := config.Load()
	
	log.Println("🚀 Starting APISIX GoFiber Backend Server with API Key Authentication...")
	log.Printf("📋 Environment: %s", cfg.Server.Environment)
	
	// Validate configuration
	if errors := cfg.Validate(); len(errors) > 0 {
		log.Fatal("❌ Configuration validation failed:", errors)
	}
	
	// เพิ่มการรอ MariaDB ให้พร้อม
	log.Println("⏳ Waiting for MariaDB to be ready...")
	time.Sleep(10 * time.Second)
	
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
	
	// Run API key migrations
	if err := database.MigrateAPIKeyTables(db); err != nil {
		log.Fatal("❌ Failed to migrate API key tables:", err)
	}
	
	log.Println("✅ Database migrations completed")
	
	// Initialize API Key Service
	log.Println("🔑 Initializing API Key Service...")
	apiKeyService := services.NewAPIKeyService(db)
	
	// Create default API keys for development
	if cfg.Features.EnableSampleData {
		log.Println("🔑 Creating default API keys...")
		if err := apiKeyService.CreateDefaultAPIKeys(); err != nil {
			log.Printf("⚠️  Warning: Failed to create default API keys: %v", err)
		} else {
			log.Println("✅ Default API keys created successfully")
		}
	}
	
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
		routeConfigPath = "/app/apisix.yaml"
	}
	
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
		ServerHeader:          "GoFiber APISIX Backend with API Key Auth",
		AppName:               "APISIX Backend with API Key Authentication v2.1.0",
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

	// Setup authentication routes
	log.Println("🔑 Setting up authentication routes...")
	routes.SetupAuthRoutes(app, apiKeyService)
	
	// Setup main routes with API key authentication
	log.Println("🛣️  Setting up routes with API key authentication...")
	routes.SetupRoutesWithAuth(app, db, apiKeyService)
	
	log.Println("✅ Routes configured successfully")
	log.Println("🔑 API Key Authentication endpoints available:")
	log.Println("   - POST   /api/auth/validate (validate API key)")
	log.Println("   - GET    /api/auth/info (get current API key info)")
	log.Println("   - POST   /api/auth/keys (create API key - admin)")
	log.Println("   - GET    /api/auth/keys?user_id=admin (list API keys - admin)")
	log.Println("   - PUT    /api/auth/keys/:id (update API key - admin)")
	log.Println("   - DELETE /api/auth/keys/:id (delete API key - admin)")
	log.Println("   - GET    /api/auth/test (test API key authentication)")

	// Graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("🛑 Gracefully shutting down...")
		
		if err := database.Close(db); err != nil {
			log.Printf("❌ Error closing database: %v", err)
		} else {
			log.Println("✅ Database connection closed")
		}
		
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
	log.Printf("   Data API:           http://%s/api/data (API key required)", address)
	log.Printf("   Route Management:   http://%s/api/routes (API key required)", address)
	log.Printf("   Authentication:     http://%s/api/auth", address)
	log.Printf("   Dashboard:          http://localhost:5173")
	log.Println("")
	log.Println("🎉 GoFiber backend with API Key Authentication ready!")
	log.Println("🔑 Use the /api/auth endpoints to manage API keys")
	
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