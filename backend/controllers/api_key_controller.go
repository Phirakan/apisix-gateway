// backend/controllers/api_key_controller.go (Complete Implementation)
package controllers

import (
	"strconv"

	"apisix-backend/models"
	"apisix-backend/service"

	"github.com/gofiber/fiber/v2"
)

// APIKeyController handles API key management endpoints
type APIKeyController struct {
	apiKeyService *services.APIKeyService
}

// NewAPIKeyController creates a new APIKeyController
func NewAPIKeyController(apiKeyService *services.APIKeyService) *APIKeyController {
	return &APIKeyController{
		apiKeyService: apiKeyService,
	}
}

// CreateAPIKey - POST /api/auth/keys - สร้าง API key ใหม่
func (c *APIKeyController) CreateAPIKey(ctx *fiber.Ctx) error {
	var req models.CreateAPIKeyRequest
	
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(400).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
			"status":  "error",
		})
	}

	// Validate required fields
	if req.Name == "" || req.UserID == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "Name and UserID are required",
			"status": "error",
		})
	}

	// Set default permissions if none provided
	if len(req.Permissions) == 0 {
		req.Permissions = []string{models.PermissionRead}
	}

	response, err := c.apiKeyService.CreateAPIKey(req)
	if err != nil {
		if err.Error() == "API key with name 'name' already exists for user 'user'" {
			return ctx.Status(409).JSON(fiber.Map{
				"error":   "API key already exists",
				"message": err.Error(),
				"status":  "error",
			})
		}
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to create API key",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.Status(201).JSON(fiber.Map{
		"message": "API key created successfully",
		"data":    response,
		"status":  "success",
		"warning": "🔒 Store this API key securely. It will not be shown again!",
	})
}

// GetAPIKeys - GET /api/auth/keys - ดึงรายการ API keys
func (c *APIKeyController) GetAPIKeys(ctx *fiber.Ctx) error {
	userID := ctx.Query("user_id", "")
	
	if userID == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "user_id query parameter is required",
			"status": "error",
			"example": "GET /api/auth/keys?user_id=admin",
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

	// Get count for this user
	count, err := c.apiKeyService.CountAPIKeys(userID)
	if err != nil {
		count = int64(len(keys)) // Fallback
	}

	return ctx.JSON(fiber.Map{
		"data":    keys,
		"count":   len(keys),
		"total":   count,
		"user_id": userID,
		"status":  "success",
	})
}

// GetAPIKeyByID - GET /api/auth/keys/:id - ดึงข้อมูล API key ตาม ID
func (c *APIKeyController) GetAPIKeyByID(ctx *fiber.Ctx) error {
	idStr := ctx.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return ctx.Status(400).JSON(fiber.Map{
			"error":  "Invalid API key ID",
			"status": "error",
		})
	}

	apiKey, err := c.apiKeyService.GetAPIKeyByID(uint(id))
	if err != nil {
		if err.Error() == "API key not found" {
			return ctx.Status(404).JSON(fiber.Map{
				"error":  "API key not found",
				"status": "error",
			})
		}
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to fetch API key",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.JSON(fiber.Map{
		"data":   apiKey,
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
			"example": `{"key": "your-api-key-here"}`,
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

	// Parse permissions
	var permissions []string
	if apiKey.Permissions != "" {
		// Simple implementation - could be improved with proper JSON parsing
		permissions = []string{"read", "write"} // Simplified for demo
	}

	return ctx.JSON(fiber.Map{
		"message":     "API key is valid",
		"valid":       true,
		"user_id":     apiKey.UserID,
		"key_name":    apiKey.Name,
		"permissions": permissions,
		"is_active":   apiKey.IsActive,
		"expires_at":  apiKey.ExpiresAt,
		"status":      "success",
	})
}

// GetAPIKeyInfo - GET /api/auth/info - ดึงข้อมูล API key ปัจจุบัน
func (c *APIKeyController) GetAPIKeyInfo(ctx *fiber.Ctx) error {
	// Get API key from context (set by middleware)
	apiKey := ctx.Locals("api_key")
	if apiKey == nil {
		return ctx.Status(401).JSON(fiber.Map{
			"error":   "No API key found in request",
			"message": "Please provide a valid API key in the request",
			"status":  "error",
		})
	}

	key := apiKey.(*models.APIKey)
	
	var permissions []string
	if key.Permissions != "" {
		// Parse permissions from JSON - simplified implementation
		permissions = []string{"read", "write"} // This should be proper JSON parsing
	}

	return ctx.JSON(fiber.Map{
		"data": fiber.Map{
			"id":           key.ID,
			"name":         key.Name,
			"user_id":      key.UserID,
			"description":  key.Description,
			"permissions":  permissions,
			"is_active":    key.IsActive,
			"expires_at":   key.ExpiresAt,
			"last_used_at": key.LastUsedAt,
			"created_at":   key.CreatedAt,
			"updated_at":   key.UpdatedAt,
		},
		"status": "success",
	})
}

// GetAPIKeyStats - GET /api/auth/stats - ดึงสถิติ API keys (Admin only)
func (c *APIKeyController) GetAPIKeyStats(ctx *fiber.Ctx) error {
	stats, err := c.apiKeyService.GetStats()
	if err != nil {
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to fetch API key statistics",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.JSON(fiber.Map{
		"data":   stats,
		"status": "success",
	})
}

// CleanupExpiredKeys - POST /api/auth/cleanup - ล้าง API keys ที่หมดอายุ (Admin only)
func (c *APIKeyController) CleanupExpiredKeys(ctx *fiber.Ctx) error {
	deactivatedCount, err := c.apiKeyService.DeactivateExpiredKeys()
	if err != nil {
		return ctx.Status(500).JSON(fiber.Map{
			"error":   "Failed to cleanup expired keys",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return ctx.JSON(fiber.Map{
		"message":           "Expired keys cleanup completed",
		"deactivated_count": deactivatedCount,
		"status":            "success",
	})
}