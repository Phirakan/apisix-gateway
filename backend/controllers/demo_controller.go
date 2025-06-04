// backend/controllers/demo_controller.go
package controllers

import (
	"apisix-backend/models"
	"apisix-backend/service"

	"github.com/gofiber/fiber/v2"
)

// DemoController handles demo and testing endpoints
type DemoController struct {
	apiKeyService *services.APIKeyService
}

// NewDemoController creates a new DemoController
func NewDemoController(apiKeyService *services.APIKeyService) *DemoController {
	return &DemoController{
		apiKeyService: apiKeyService,
	}
}

// GetAPIKeyDemo - GET /api/demo/keys - แสดงตัวอย่าง API keys สำหรับการทดสอบ
func (dc *DemoController) GetAPIKeyDemo(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"message": "API Key Authentication Demo",
		"demo_keys": fiber.Map{
			"admin": fiber.Map{
				"description": "Full administrative access",
				"key":         "ak_admin_demo_key_2024_full_access",
				"permissions": []string{models.PermissionAdmin},
				"usage":       "Can access all endpoints including API key management",
			},
			"developer": fiber.Map{
				"description": "Developer access with route and data management",
				"key":         "ak_dev_demo_key_2024_limited_access", 
				"permissions": []string{
					models.PermissionRead,
					models.PermissionWrite,
					models.PermissionRouteManage,
					models.PermissionDataManage,
				},
				"usage": "Can manage routes and data but not API keys",
			},
			"frontend": fiber.Map{
				"description": "Frontend application access",
				"key":         "ak_frontend_demo_key_2024_app_access",
				"permissions": []string{
					models.PermissionRead,
					models.PermissionWrite,
					models.PermissionDataManage,
				},
				"usage": "Can access data endpoints for frontend applications",
			},
			"readonly": fiber.Map{
				"description": "Read-only access",
				"key":         "ak_readonly_demo_key_2024_view_only",
				"permissions": []string{models.PermissionRead},
				"usage":       "Can only view data, cannot modify anything",
			},
		},
		"test_endpoints": fiber.Map{
			"validate": "POST /api/auth/validate",
			"info":     "GET /api/auth/info",
			"test":     "GET /api/auth/test",
			"debug":    "GET /api/debug/auth",
		},
		"examples": fiber.Map{
			"header_auth": "curl -H 'X-API-Key: ak_admin_demo_key_2024_full_access' http://localhost:3000/api/data",
			"bearer_auth": "curl -H 'Authorization: Bearer ak_admin_demo_key_2024_full_access' http://localhost:3000/api/data",
			"query_auth":  "curl 'http://localhost:3000/api/data?apikey=ak_admin_demo_key_2024_full_access'",
		},
		"warning": "🚨 These are demo keys for testing only. In production, generate secure random keys!",
		"status":  "success",
	})
}

// TestPermissions - GET /api/demo/permissions - ทดสอบ permissions ต่างๆ
func (dc *DemoController) TestPermissions(c *fiber.Ctx) error {
	apiKey := c.Locals("api_key")
	if apiKey == nil {
		return c.Status(401).JSON(fiber.Map{
			"error":   "Authentication required",
			"message": "Please provide a valid API key to test permissions",
			"status":  "error",
		})
	}

	key := apiKey.(*models.APIKey)
	
	// Test various permissions
	permissions := []string{
		models.PermissionRead,
		models.PermissionWrite,
		models.PermissionDelete,
		models.PermissionAdmin,
		models.PermissionRouteManage,
		models.PermissionDataManage,
		models.PermissionAPIKeyManage,
	}

	results := make(map[string]bool)
	for _, perm := range permissions {
		err := dc.apiKeyService.CheckPermission(key.Key, perm)
		results[perm] = err == nil
	}

	return c.JSON(fiber.Map{
		"message": "Permission Test Results",
		"key_info": fiber.Map{
			"name":        key.Name,
			"user_id":     key.UserID,
			"description": key.Description,
			"is_active":   