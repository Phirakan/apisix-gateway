// backend/routes/routes.go (เพิ่ม endpoints ใหม่)
package routes

import (
	"apisix-backend/controllers"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// SetupRoutes ตั้งค่า routes ทั้งหมดของแอปพลิเคชัน
func SetupRoutes(app *fiber.App, db *gorm.DB) {
	// สร้าง controller instances
	recordController := controllers.NewRecordController(db)
	routeController := controllers.NewRouteController() // Route Management

	// API group
	api := app.Group("/api")

	// ========== EXISTING ENDPOINTS ==========
	// Health check endpoint
	api.Get("/health", recordController.GetHealth)

	// Data routes group (existing CRUD for records)
	data := api.Group("/data")
	data.Get("/", recordController.GetAllRecords)           // GET /api/data
	data.Post("/", recordController.CreateRecord)           // POST /api/data
	data.Get("/:id", recordController.GetRecordByID)        // GET /api/data/:id
	data.Put("/:id", recordController.UpdateRecord)         // PUT /api/data/:id
	data.Delete("/:id", recordController.DeleteRecord)      // DELETE /api/data/:id
	data.Get("/paginated", recordController.GetRecordsPaginated) // GET /api/data/paginated
	data.Post("/bulk", recordController.BulkCreateRecords)       // POST /api/data/bulk

	// ========== NEW: ROUTE MANAGEMENT ENDPOINTS ==========
	// Routes management group
	routes := api.Group("/routes")
	
	// Basic CRUD operations for routes
	routes.Get("/", routeController.GetAllRoutes)           // GET /api/routes - List all routes
	routes.Post("/", routeController.CreateRoute)           // POST /api/routes - Create new route
	routes.Get("/:id", routeController.GetRouteByID)        // GET /api/routes/:id - Get route by ID
	routes.Put("/:id", routeController.UpdateRoute)         // PUT /api/routes/:id - Update route
	routes.Delete("/:id", routeController.DeleteRoute)      // DELETE /api/routes/:id - Delete route
	
	// Special routes management endpoints
	routes.Post("/quick", routeController.CreateQuickRoute) // POST /api/routes/quick - Create route from template
	routes.Get("/templates", routeController.GetRouteTemplates) // GET /api/routes/templates - Get available templates
	routes.Post("/reload", routeController.ReloadAPISIX)    // POST /api/routes/reload - Reload APISIX config
	
	// NEW: Configuration management endpoints
	routes.Get("/validate", routeController.ValidateConfig) // GET /api/routes/validate - Validate config
	routes.Get("/config", routeController.GetConfigInfo)    // GET /api/routes/config - Get config info

	// Upstreams management
	api.Get("/upstreams", routeController.GetUpstreams)     // GET /api/upstreams - List all upstreams

	// ========== ROOT ENDPOINT ==========
	// Root endpoint with comprehensive API documentation
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "APISIX GoFiber Backend with Dynamic Route Management",
			"version": "2.1.0",
			"features": []string{
				"Dynamic Route Management with Shared Volume",
				"APISIX Configuration API",
				"Real-time Route Updates",
				"Template-based Route Creation",
				"Configuration Validation",
				"Health Monitoring",
				"Data CRUD Operations",
				"Automatic Config Backup",
			},
			"config": fiber.Map{
				"shared_volume_path": "/shared/apisix.yaml",
				"docker_compose":     "Configured for container communication",
				"auto_sync":          "Configuration synced between containers",
			},
			"endpoints": fiber.Map{
				"health": fiber.Map{
					"url":         "GET /api/health",
					"description": "Health check endpoint",
				},
				"data_api": fiber.Map{
					"list":        "GET /api/data",
					"create":      "POST /api/data",
					"get":         "GET /api/data/:id",
					"update":      "PUT /api/data/:id",
					"delete":      "DELETE /api/data/:id",
					"paginated":   "GET /api/data/paginated?page=1&limit=10&search=keyword",
					"bulk_create": "POST /api/data/bulk",
				},
				"route_management": fiber.Map{
					"list_routes":     "GET /api/routes",
					"create_route":    "POST /api/routes",
					"get_route":       "GET /api/routes/:id",
					"update_route":    "PUT /api/routes/:id",
					"delete_route":    "DELETE /api/routes/:id",
					"quick_create":    "POST /api/routes/quick",
					"templates":       "GET /api/routes/templates",
					"reload_apisix":   "POST /api/routes/reload",
					"validate_config": "GET /api/routes/validate",
					"config_info":     "GET /api/routes/config",
					"list_upstreams":  "GET /api/upstreams",
				},
			},
			"usage": fiber.Map{
				"dashboard_url": "http://localhost:5173",
				"gateway_url":   "http://localhost:9080",
				"restart_cmd":   "docker-compose restart apisix_api",
				"examples": fiber.Map{
					"create_wordpress_route": fiber.Map{
						"method": "POST",
						"url":    "/api/routes/quick",
						"body": fiber.Map{
							"type":   "wordpress",
							"name":   "WordPress Posts API",
							"uri":    "/api/wp-posts/*",
							"target": "wordpress",
							"port":   80,
						},
					},
					"create_gofiber_route": fiber.Map{
						"method": "POST",
						"url":    "/api/routes/quick",
						"body": fiber.Map{
							"type":   "gofiber",
							"name":   "Custom GoFiber API",
							"uri":    "/api/custom/*",
							"target": "gofiber-backend",
							"port":   3000,
						},
					},
					"test_route_through_gateway": fiber.Map{
						"description": "After creating a route, test it through APISIX Gateway",
						"example_url": "http://localhost:9080/api/wp-posts",
						"note":        "Restart APISIX container after route changes",
					},
				},
			},
			"status": "ready",
			"timestamp": fiber.Map{
				"server_start": "Ready for dynamic route management with shared volumes",
			},
		})
	})

	// ========== DEVELOPMENT HELPER ENDPOINTS ==========
	// Debug endpoint to show current configuration
	api.Get("/debug/config", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "APISIX Configuration Debug Info",
			"config_files": fiber.Map{
				"shared_volume": "/shared/apisix.yaml",
				"host_mount":   "./apisix/apisix.yaml",
			},
			"docker_setup": fiber.Map{
				"apisix_container":   "Uses shared volume: apisix_config_volume",
				"gofiber_container": "Uses shared volume: apisix_config_volume mounted at /shared",
				"config_sync":       "Automatic sync between containers",
			},
			"status": "Route management active with shared volume configuration",
			"note": "Check logs for configuration changes",
		})
	})

	// Ping endpoint for connectivity testing
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "pong",
			"status":  "ok",
			"service": "gofiber-backend",
			"config":  "shared-volume-enabled",
			"features": []string{
				"route-management",
				"shared-volume-config",
				"data-api",
				"health-checks",
				"config-validation",
			},
		})
	})

	// Configuration status endpoint
	api.Get("/status/config", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Configuration Status",
			"shared_volume": fiber.Map{
				"enabled": true,
				"path":    "/shared/apisix.yaml",
				"sync":    "automatic",
			},
			"container_communication": fiber.Map{
				"apisix_to_gofiber": "via Docker network: gateway-net",
				"config_sharing":    "via named volume: apisix_config_volume",
			},
			"restart_required": fiber.Map{
				"when":    "After route configuration changes",
				"command": "docker-compose restart apisix_api",
				"reason":  "APISIX needs to reload configuration file",
			},
			"status": "ready",
		})
	})
}