package routes

import (
	"apisix-backend/controllers"
	"apisix-backend/middleware"
	"apisix-backend/models"
	"apisix-backend/service"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// SetupRoutesWithAuth ตั้งค่า routes ทั้งหมดของแอปพลิเคชันพร้อม API key authentication
func SetupRoutesWithAuth(app *fiber.App, db *gorm.DB, apiKeyService *services.APIKeyService) {
	// สร้าง controller instances
	recordController := controllers.NewRecordController(db)
	routeController := controllers.NewRouteController()

	// API group
	api := app.Group("/api")

	// ========== PUBLIC ENDPOINTS (No API Key Required) ==========
	// Health check endpoint
	api.Get("/health", recordController.GetHealth)

	// Root endpoint with comprehensive API documentation
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "APISIX GoFiber Backend with API Key Authentication",
			"version": "2.2.0",
			"features": []string{
				"API Key Authentication System",
				"Dynamic Route Management",
				"APISIX Configuration API",
				"Real-time Route Updates",
				"Permission-based Access Control",
				"Data CRUD Operations",
				"Health Monitoring",
				"Configuration Validation",
			},
			"authentication": fiber.Map{
				"type":        "API Key",
				"header":      "X-API-Key: your-api-key",
				"alternative": "Authorization: Bearer your-api-key",
				"query":       "?apikey=your-api-key",
			},
			"endpoints": fiber.Map{
				"public": fiber.Map{
					"health":    "GET /api/health",
					"auth_test": "GET /api/auth/test",
					"validate":  "POST /api/auth/validate",
				},
				"protected": fiber.Map{
					"data_api": fiber.Map{
						"list":        "GET /api/data (requires API key)",
						"create":      "POST /api/data (requires API key)",
						"get":         "GET /api/data/:id (requires API key)",
						"update":      "PUT /api/data/:id (requires API key)",
						"delete":      "DELETE /api/data/:id (requires API key)",
						"paginated":   "GET /api/data/paginated (requires API key)",
						"bulk_create": "POST /api/data/bulk (requires API key)",
					},
					"route_management": fiber.Map{
						"list_routes":     "GET /api/routes (read permission)",
						"create_route":    "POST /api/routes (route:manage permission)",
						"update_route":    "PUT /api/routes/:id (route:manage permission)",
						"delete_route":    "DELETE /api/routes/:id (route:manage permission)",
						"quick_create":    "POST /api/routes/quick (route:manage permission)",
						"templates":       "GET /api/routes/templates (read permission)",
						"reload_apisix":   "POST /api/routes/reload (admin permission)",
					},
					"api_key_management": fiber.Map{
						"create_key":  "POST /api/auth/keys (apikey:manage permission)",
						"list_keys":   "GET /api/auth/keys (apikey:manage permission)",
						"update_key":  "PUT /api/auth/keys/:id (apikey:manage permission)",
						"delete_key":  "DELETE /api/auth/keys/:id (apikey:manage permission)",
						"key_info":    "GET /api/auth/info (valid API key)",
					},
				},
			},
			"permissions": fiber.Map{
				"read":         "Read access to resources",
				"write":        "Write access to resources", 
				"delete":       "Delete access to resources",
				"admin":        "Full administrative access",
				"route:manage": "Route management access",
				"data:manage":  "Data management access",
				"apikey:manage": "API key management access",
			},
			"example_usage": fiber.Map{
				"get_data_with_api_key": fiber.Map{
					"method": "GET",
					"url":    "/api/data",
					"headers": fiber.Map{
						"X-API-Key": "your-api-key-here",
					},
				},
				"create_route_with_auth": fiber.Map{
					"method": "POST", 
					"url":    "/api/routes/quick",
					"headers": fiber.Map{
						"X-API-Key":    "admin-api-key-2024",
						"Content-Type": "application/json",
					},
					"body": fiber.Map{
						"type":   "wordpress",
						"name":   "WordPress API",
						"uri":    "/api/wp/*",
						"target": "wordpress",
						"port":   80,
					},
				},
			},
			"status": "ready",
		})
	})

	// ========== PROTECTED ENDPOINTS (API Key Required) ==========

	// Data routes group with API key authentication
	data := api.Group("/data")
	data.Use(middleware.APIKeyMiddleware(apiKeyService, models.PermissionDataManage))
	
	data.Get("/", recordController.GetAllRecords)           // GET /api/data
	data.Post("/", recordController.CreateRecord)           // POST /api/data
	data.Get("/:id", recordController.GetRecordByID)        // GET /api/data/:id
	data.Put("/:id", recordController.UpdateRecord)         // PUT /api/data/:id
	data.Delete("/:id", recordController.DeleteRecord)      // DELETE /api/data/:id
	data.Get("/paginated", recordController.GetRecordsPaginated) // GET /api/data/paginated
	data.Post("/bulk", recordController.BulkCreateRecords)       // POST /api/data/bulk

	// Routes management group with different permission levels
	routes := api.Group("/routes")
	
	// Read-only routes (read permission required)
	routes.Get("/", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRead), routeController.GetAllRoutes)
	routes.Get("/templates", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRead), routeController.GetRouteTemplates)
	routes.Get("/config", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRead), routeController.GetConfigInfo)
	routes.Get("/validate", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRead), routeController.ValidateConfig)
	routes.Get("/:id", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRead), routeController.GetRouteByID)
	
	// Write operations (route:manage permission required)
	routes.Post("/", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRouteManage), routeController.CreateRoute)
	routes.Put("/:id", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRouteManage), routeController.UpdateRoute)
	routes.Delete("/:id", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRouteManage), routeController.DeleteRoute)
	routes.Post("/quick", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRouteManage), routeController.CreateQuickRoute)
	
	// Admin operations (admin permission required)
	routes.Post("/reload", middleware.APIKeyMiddleware(apiKeyService, models.PermissionAdmin), routeController.ReloadAPISIX)

	// Upstreams management (read permission required)
	api.Get("/upstreams", middleware.APIKeyMiddleware(apiKeyService, models.PermissionRead), routeController.GetUpstreams)

	// ========== DEVELOPMENT HELPER ENDPOINTS ==========
	
	// Debug endpoint with optional authentication
	api.Get("/debug/auth", middleware.OptionalAPIKeyMiddleware(apiKeyService), func(c *fiber.Ctx) error {
		apiKey := c.Locals("api_key")
		userID := c.Locals("user_id")

		response := fiber.Map{
			"message": "Authentication Debug Info",
			"path":    c.Path(),
			"method":  c.Method(),
			"headers": fiber.Map{
				"x_api_key":     c.Get("X-API-Key"),
				"authorization": c.Get("Authorization"),
			},
			"query": fiber.Map{
				"apikey":  c.Query("apikey"),
				"api_key": c.Query("api_key"),
			},
		}

		if apiKey != nil {
			key := apiKey.(*models.APIKey)
			response["authentication"] = fiber.Map{
				"authenticated": true,
				"user_id":       userID,
				"key_name":      key.Name,
				"key_active":    key.IsActive,
				"expires_at":    key.ExpiresAt,
				"last_used":     key.LastUsedAt,
			}
		} else {
			response["authentication"] = fiber.Map{
				"authenticated": false,
				"message":       "No valid API key provided",
			}
		}

		return c.JSON(response)
	})

	// Ping endpoint with authentication info
	api.Get("/ping", middleware.OptionalAPIKeyMiddleware(apiKeyService), func(c *fiber.Ctx) error {
		response := fiber.Map{
			"message": "pong",
			"status":  "ok",
			"service": "gofiber-backend",
			"features": []string{
				"api-key-authentication",
				"permission-based-access",
				"route-management",
				"data-api",
				"health-checks",
			},
		}

		if apiKey := c.Locals("api_key"); apiKey != nil {
			key := apiKey.(*models.APIKey)
			response["authenticated"] = true
			response["user_id"] = key.UserID
			response["key_name"] = key.Name
		} else {
			response["authenticated"] = false
		}

		return c.JSON(response)
	})

	// Configuration status endpoint with authentication
	api.Get("/status/auth", middleware.OptionalAPIKeyMiddleware(apiKeyService), func(c *fiber.Ctx) error {
		response := fiber.Map{
			"message": "Authentication System Status",
			"api_key_auth": fiber.Map{
				"enabled":     true,
				"type":        "Database-stored API keys",
				"permissions": "Role-based access control",
			},
			"endpoints": fiber.Map{
				"public":    []string{"/api/health", "/api/auth/test", "/api/auth/validate"},
				"protected": []string{"/api/data/*", "/api/routes/*", "/api/auth/keys/*"},
			},
			"headers": fiber.Map{
				"primary":     "X-API-Key: your-api-key",
				"alternative": "Authorization: Bearer your-api-key",
				"query":       "?apikey=your-api-key",
			},
		}

		if apiKey := c.Locals("api_key"); apiKey != nil {
			key := apiKey.(*models.APIKey)
			response["current_user"] = fiber.Map{
				"user_id":    key.UserID,
				"key_name":   key.Name,
				"is_active":  key.IsActive,
				"expires_at": key.ExpiresAt,
			}
		} else {
			response["current_user"] = "Not authenticated"
		}

		return c.JSON(response)
	})
}
