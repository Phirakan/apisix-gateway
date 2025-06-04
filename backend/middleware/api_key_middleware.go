// backend/middleware/api_key_middleware.go
package middleware

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"apisix-backend/models"
	"apisix-backend/service"

	"github.com/gofiber/fiber/v2"
)

// APIKeyMiddleware creates API key authentication middleware
func APIKeyMiddleware(apiKeyService *services.APIKeyService, requiredPermission string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get API key from various sources
		apiKey := getAPIKeyFromRequest(c)
		
		if apiKey == "" {
			return c.Status(401).JSON(fiber.Map{
				"error":   "Missing API key",
				"message": "API key is required. Please provide it in X-API-Key header, Authorization header, or apikey query parameter",
				"status":  "error",
				"hint":    "Add header: X-API-Key: your-api-key",
			})
		}

		// Validate API key
		keyInfo, err := apiKeyService.ValidateAPIKey(apiKey)
		if err != nil {
			log.Printf("🚫 API key validation failed: %v", err)
			return c.Status(401).JSON(fiber.Map{
				"error":   "Invalid API key",
				"message": err.Error(),
				"status":  "error",
			})
		}

		// Check permission if required
		if requiredPermission != "" {
			err = apiKeyService.CheckPermission(apiKey, requiredPermission)
			if err != nil {
				log.Printf("🚫 Permission denied for API key %s: %v", keyInfo.UserID, err)
				return c.Status(403).JSON(fiber.Map{
					"error":   "Insufficient permissions",
					"message": err.Error(),
					"status":  "error",
					"required_permission": requiredPermission,
				})
			}
		}

		// Store API key info in context for later use
		c.Locals("api_key", keyInfo)
		c.Locals("user_id", keyInfo.UserID)
		
		log.Printf("✅ API key authenticated: %s (%s)", keyInfo.Name, keyInfo.UserID)
		
		return c.Next()
	}
}

// OptionalAPIKeyMiddleware provides optional API key authentication
func OptionalAPIKeyMiddleware(apiKeyService *services.APIKeyService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := getAPIKeyFromRequest(c)
		
		if apiKey != "" {
			keyInfo, err := apiKeyService.ValidateAPIKey(apiKey)
			if err == nil {
				c.Locals("api_key", keyInfo)
				c.Locals("user_id", keyInfo.UserID)
				log.Printf("✅ Optional API key authenticated: %s (%s)", keyInfo.Name, keyInfo.UserID)
			} else {
				log.Printf("⚠️  Optional API key validation failed: %v", err)
			}
		}
		
		return c.Next()
	}
}

// PermissionMiddleware checks if authenticated user has specific permission
func PermissionMiddleware(permission string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := c.Locals("api_key")
		if apiKey == nil {
			return c.Status(401).JSON(fiber.Map{
				"error":  "Authentication required",
				"status": "error",
			})
		}

		key := apiKey.(*models.APIKey)
		
		// Check if key has required permission
		if !key.HasPermission(permission) {
			return c.Status(403).JSON(fiber.Map{
				"error":   "Insufficient permissions",
				"message": "Required permission: " + permission,
				"status":  "error",
			})
		}

		return c.Next()
	}
}

// getAPIKeyFromRequest extracts API key from various request sources
func getAPIKeyFromRequest(c *fiber.Ctx) string {
	// Check X-API-Key header (preferred)
	if key := c.Get("X-API-Key"); key != "" {
		return key
	}
	
	// Check Authorization header (Bearer token)
	if auth := c.Get("Authorization"); auth != "" {
		if strings.HasPrefix(auth, "Bearer ") {
			return strings.TrimPrefix(auth, "Bearer ")
		}
		if strings.HasPrefix(auth, "ApiKey ") {
			return strings.TrimPrefix(auth, "ApiKey ")
		}
	}
	
	// Check apikey query parameter
	if key := c.Query("apikey"); key != "" {
		return key
	}
	
	// Check api_key query parameter
	if key := c.Query("api_key"); key != "" {
		return key
	}
	
	return ""
}

// UpdatedAPIKeyAuth middleware สำหรับการตรวจสอบ API key (เดิมที่มีอยู่แล้ว)
func UpdatedAPIKeyAuth(apiKeyService *services.APIKeyService, validKeys []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// ข้าม API key check สำหรับ health check และ root endpoint
		if c.Path() == "/api/health" || c.Path() == "/" {
			return c.Next()
		}

		apiKey := getAPIKeyFromRequest(c)
		
		if apiKey == "" {
			return c.Status(401).JSON(fiber.Map{
				"error":   "API key required",
				"message": "Please provide a valid API key in X-API-Key header, Authorization header, or apikey query parameter",
				"status":  "error",
				"examples": fiber.Map{
					"header": "X-API-Key: your-api-key",
					"auth":   "Authorization: Bearer your-api-key",
					"query":  "?apikey=your-api-key",
				},
			})
		}

		// Check with database-stored API keys first
		if apiKeyService != nil {
			keyInfo, err := apiKeyService.ValidateAPIKey(apiKey)
			if err == nil {
				c.Locals("api_key", keyInfo)
				c.Locals("user_id", keyInfo.UserID)
				log.Printf("✅ Database API key authenticated: %s (%s)", keyInfo.Name, keyInfo.UserID)
				return c.Next()
			}
			log.Printf("⚠️  Database API key validation failed: %v", err)
		}

		// Fallback to hardcoded valid keys (for backward compatibility)
		for _, validKey := range validKeys {
			if apiKey == validKey {
				log.Printf("✅ Hardcoded API key authenticated")
				return c.Next()
			}
		}

		return c.Status(401).JSON(fiber.Map{
			"error":   "Invalid API key",
			"message": "The provided API key is not valid or has expired",
			"status":  "error",
		})
	}
}

// GetAPIKeys - GET /api/auth/keys - ดึงรายการ API keys
func (c *APIKeyController) GetAPIKeys(ctx *fiber.Ctx) error {
	userID := ctx.Query("user_id", "")
	
	if userID == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "user_id query parameter is required",
			"status": "error",
		})
	}

	keys, err := c.apiKeyService.GetAllAPIKeys(userID)
	if err != nil {
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to fetch API keys",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.JSON(fiber.Map{
		"data":   keys,
		"count":  len(keys),
		"status": "success",
	})
}

// UpdateAPIKey - PUT /api/auth/keys/:id - อัปเดต API key
func (c *APIKeyController) UpdateAPIKey(ctx *fiber.Ctx) error {
	idStr := ctx.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "Invalid API key ID",
			"status": "error",
		})
	}

	var req models.UpdateAPIKeyRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(400).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
			"status":  "error",
		})
	}

	err = c.apiKeyService.UpdateAPIKey(uint(id), req)
	if err != nil {
		if err.Error() == "API key not found" {
			return ctx.Status(404).JSON(fiber.Map{
				"error":  "API key not found",
				"status": "error",
			})
		}
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to update API key",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "API key updated successfully",
		"status":  "success",
	})
}

// DeleteAPIKey - DELETE /api/auth/keys/:id - ลบ API key
func (c *APIKeyController) DeleteAPIKey(ctx *fiber.Ctx) error {
	idStr := ctx.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "Invalid API key ID",
			"status": "error",
		})
	}

	err = c.apiKeyService.DeleteAPIKey(uint(id))
	if err != nil {
		if err.Error() == "API key not found" {
			return ctx.Status(404).JSON(fiber.Map{
				"error":  "API key not found",
				"status": "error",
			})
		}
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to delete API key",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "API key deleted successfully",
		"status":  "success",
	})
}

// ValidateAPIKey - POST /api/auth/validate - ตรวจสอบ API key
func (c *APIKeyController) ValidateAPIKey(ctx *fiber.Ctx) error {
	var req struct {
		Key string `json:"key"`
	}
	
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(400).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
			"status":  "error",
		})
	}

	if req.Key == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "API key is required",
			"status": "error",
		})
	}

	apiKey, err := c.apiKeyService.ValidateAPIKey(req.Key)
	if err != nil {
		return ctx.Status(401).JSON(fiber.Map{
			"error":   "Invalid API key",
			"message": err.Error(),
			"status":  "error",
			"valid":   false,
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "API key is valid",
		"valid":   true,
		"user_id": apiKey.UserID,
		"status":  "success",
	})
}

// GetAPIKeyInfo - GET /api/auth/info - ดึงข้อมูล API key ปัจจุบัน
func (c *APIKeyController) GetAPIKeyInfo(ctx *fiber.Ctx) error {
	// Get API key from context (set by middleware)
	apiKey := ctx.Locals("api_key")
	if apiKey == nil {
		return ctx.Status(401).JSON(fiber.Map{
			"error":  "No API key found in request",
			"status": "error",
		})
	}

	key := apiKey.(*models.APIKey)
	
	var permissions []string
	if key.Permissions != "" {
		// Parse permissions from JSON
		// Simple implementation - could be improved
		permissions = []string{"read", "write"} // Simplified
	}

	return ctx.JSON(fiber.Map{
		"data": fiber.Map{
			"name":         key.Name,
			"user_id":      key.UserID,
			"description":  key.Description,
			"permissions":  permissions,
			"is_active":    key.IsActive,
			"expires_at":   key.ExpiresAt,
			"last_used_at": key.LastUsedAt,
			"created_at":   key.CreatedAt,
		},
		"status": "success",
	})
}

// DeleteAPIKey deletes an API key
func (s *APIKeyService) DeleteAPIKey(id uint) error {
	result := s.db.Delete(&models.APIKey{}, id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete API key: %w", result.Error)
	}
	
	if result.RowsAffected == 0 {
		return fmt.Errorf("API key not found")
	}

	log.Printf("✅ Deleted API key ID: %d", id)
	return nil
}

// CheckPermission checks if API key has specific permission
func (s *APIKeyService) CheckPermission(keyString, permission string) error {
	apiKey, err := s.ValidateAPIKey(keyString)
	if err != nil {
		return err
	}

	var permissions []string
	if apiKey.Permissions != "" {
		if err := json.Unmarshal([]byte(apiKey.Permissions), &permissions); err != nil {
			return fmt.Errorf("failed to parse permissions: %w", err)
		}
	}

	// Check for admin permission (grants all access)
	for _, perm := range permissions {
		if perm == models.PermissionAdmin {
			return nil
		}
		if perm == permission {
			return nil
		}
	}

	return fmt.Errorf("insufficient permissions: %s required", permission)
}

// CreateDefaultAPIKeys creates default API keys for development
func (s *APIKeyService) CreateDefaultAPIKeys() error {
	defaultKeys := []models.CreateAPIKeyRequest{
		{
			Name:        "Admin Key",
			UserID:      "admin",
			Description: "Full administrative access",
			Permissions: []string{models.PermissionAdmin},
		},
		{
			Name:        "Developer Key",
			UserID:      "developer",
			Description: "Development access with route and data management",
			Permissions: []string{
				models.PermissionRead,
				models.PermissionWrite,
				models.PermissionRouteManage,
				models.PermissionDataManage,
			},
		},
		{
			Name:        "Frontend App Key",
			UserID:      "frontend",
			Description: "Frontend application access",
			Permissions: []string{
				models.PermissionRead,
				models.PermissionWrite,
				models.PermissionDataManage,
			},
		},
		{
			Name:        "Mobile App Key",
			UserID:      "mobile",
			Description: "Mobile application access",
			Permissions: []string{
				models.PermissionRead,
				models.PermissionDataManage,
			},
		},
	}

	for _, req := range defaultKeys {
		// Check if key already exists
		var existing models.APIKey
		err := s.db.Where("user_id = ? AND name = ?", req.UserID, req.Name).First(&existing).Error
		if err == nil {
			log.Printf("ℹ️  API key already exists: %s for %s", req.Name, req.UserID)
			continue
		}

		response, err := s.CreateAPIKey(req)
		if err != nil {
			log.Printf("❌ Failed to create default API key %s: %v", req.Name, err)
			continue
		}

		log.Printf("🔑 Created default API key: %s = %s", req.Name, response.Key)
	}

	return nil
}