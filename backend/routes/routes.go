// backend/routes/routes.go (Fixed imports)
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

	// Upstreams management
	api.Get("/upstreams", routeController.GetUpstreams)     // GET /api/upstreams - List all upstreams

	// ========== ROOT ENDPOINT ==========
	// Root endpoint with comprehensive API documentation
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "APISIX GoFiber Backend with Dynamic Route Management",
			"version": "2.0.0",
			"features": []string{
				"Dynamic Route Management",
				"APISIX Configuration API",
				"Real-time Route Updates",
				"Template-based Route Creation",
				"Health Monitoring",
				"Data CRUD Operations",
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
					"list_upstreams":  "GET /api/upstreams",
				},
			},
			"usage": fiber.Map{
				"dashboard_url": "http://localhost:5173",
				"gateway_url":   "http://localhost:9080",
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
				"server_start": "Ready for dynamic route management",
			},
		})
	})

	// ========== DEVELOPMENT HELPER ENDPOINTS ==========
	// Debug endpoint to show current configuration
	api.Get("/debug/config", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "APISIX Configuration Debug Info",
			"config_file": "/app/apisix.yaml",
			"status": "Route management active",
			"note": "Check logs for configuration changes",
		})
	})

	// Ping endpoint for connectivity testing
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "pong",
			"status":  "ok",
			"service": "gofiber-backend",
			"features": []string{
				"route-management",
				"data-api",
				"health-checks",
			},
		})
	})
}