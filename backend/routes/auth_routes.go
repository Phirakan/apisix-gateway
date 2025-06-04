package routes

import (
	"apisix-backend/controllers"
	"apisix-backend/middleware"
	"apisix-backend/models"
	"apisix-backend/service"

	"github.com/gofiber/fiber/v2"
)

// SetupAuthRoutes ตั้งค่า authentication routes
func SetupAuthRoutes(app *fiber.App, apiKeyService *services.APIKeyService) {
	// API Key Controller
	apiKeyController := controllers.NewAPIKeyController(apiKeyService)

	// Auth API group
	auth := app.Group("/api/auth")

	// Public authentication endpoints (no API key required)
	auth.Post("/validate", apiKeyController.ValidateAPIKey)

	// Protected API key management endpoints (require admin permission)
	adminAuth := auth.Group("/keys", middleware.APIKeyMiddleware(apiKeyService, models.PermissionAPIKeyManage))
	adminAuth.Post("/", apiKeyController.CreateAPIKey)           // POST /api/auth/keys
	adminAuth.Get("/", apiKeyController.GetAPIKeys)             // GET /api/auth/keys?user_id=admin
	adminAuth.Put("/:id", apiKeyController.UpdateAPIKey)        // PUT /api/auth/keys/:id
	adminAuth.Delete("/:id", apiKeyController.DeleteAPIKey)     // DELETE /api/auth/keys/:id

	// Get current API key info (require valid API key)
	auth.Get("/info", middleware.APIKeyMiddleware(apiKeyService, ""), apiKeyController.GetAPIKeyInfo)

	// Development helper endpoints
	auth.Get("/permissions", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"permissions": map[string]string{
				models.PermissionRead:         "Read access to resources",
				models.PermissionWrite:        "Write access to resources",
				models.PermissionDelete:       "Delete access to resources",
				models.PermissionAdmin:        "Full administrative access",
				models.PermissionRouteManage:  "Route management access",
				models.PermissionDataManage:   "Data management access",
				models.PermissionAPIKeyManage: "API key management access",
			},
			"status": "success",
		})
	})

	// Test endpoint for API key functionality
	auth.Get("/test", middleware.OptionalAPIKeyMiddleware(apiKeyService), func(c *fiber.Ctx) error {
		apiKey := c.Locals("api_key")
		userID := c.Locals("user_id")

		if apiKey == nil {
			return c.JSON(fiber.Map{
				"message":        "No API key provided - public access",
				"authenticated": false,
				"status":        "success",
			})
		}

		key := apiKey.(*models.APIKey)
		return c.JSON(fiber.Map{
			"message":        "API key authenticated successfully",
			"authenticated":  true,
			"user_id":        userID,
			"key_name":       key.Name,
			"permissions":    key.Permissions,
			"status":         "success",
		})
	})
}