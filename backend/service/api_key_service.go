// backend/service/api_key_service.go (Complete Implementation)
package services

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"apisix-backend/models"
	"gorm.io/gorm"
)

// APIKeyService handles API key management
type APIKeyService struct {
	db *gorm.DB
}

// NewAPIKeyService creates a new APIKeyService
func NewAPIKeyService(db *gorm.DB) *APIKeyService {
	service := &APIKeyService{db: db}
	log.Println("🔑 API Key Service initialized")
	return service
}

// GenerateAPIKey generates a secure random API key
func (s *APIKeyService) GenerateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return "ak_" + hex.EncodeToString(bytes), nil
}

// CreateAPIKey creates a new API key
func (s *APIKeyService) CreateAPIKey(req models.CreateAPIKeyRequest) (*models.APIKeyResponse, error) {
	log.Printf("🔑 Creating API key: %s for user: %s", req.Name, req.UserID)

	// Check if user already has a key with the same name
	var existingKey models.APIKey
	err := s.db.Where("user_id = ? AND name = ?", req.UserID, req.Name).First(&existingKey).Error
	if err == nil {
		return nil, fmt.Errorf("API key with name '%s' already exists for user '%s'", req.Name, req.UserID)
	}

	key, err := s.GenerateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	permissionsJSON, err := json.Marshal(req.Permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal permissions: %w", err)
	}

	apiKey := models.APIKey{
		Name:        req.Name,
		Key:         key,
		UserID:      req.UserID,
		Description: req.Description,
		Permissions: string(permissionsJSON),
		IsActive:    true,
		ExpiresAt:   req.ExpiresAt,
	}

	if err := s.db.Create(&apiKey).Error; err != nil {
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}

	log.Printf("✅ Created API key: %s for user: %s", apiKey.Name, apiKey.UserID)

	return &models.APIKeyResponse{
		ID:          apiKey.ID,
		Name:        apiKey.Name,
		Key:         key, // Only return key on creation
		UserID:      apiKey.UserID,
		Description: apiKey.Description,
		Permissions: req.Permissions,
		IsActive:    apiKey.IsActive,
		ExpiresAt:   apiKey.ExpiresAt,
		CreatedAt:   apiKey.CreatedAt,
		UpdatedAt:   apiKey.UpdatedAt,
	}, nil
}

// ValidateAPIKey validates an API key and returns the key info
func (s *APIKeyService) ValidateAPIKey(keyString string) (*models.APIKey, error) {
	if keyString == "" {
		return nil, fmt.Errorf("API key cannot be empty")
	}

	var apiKey models.APIKey
	
	err := s.db.Where("key = ? AND is_active = ?", keyString, true).First(&apiKey).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("invalid API key")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	if apiKey.IsExpired() {
		return nil, fmt.Errorf("API key has expired")
	}

	// Update last used timestamp
	apiKey.UpdateLastUsed()
	if err := s.db.Save(&apiKey).Error; err != nil {
		log.Printf("⚠️  Warning: Failed to update last used timestamp: %v", err)
	}

	return &apiKey, nil
}

// GetAllAPIKeys returns all API keys for a user (without the actual key)
func (s *APIKeyService) GetAllAPIKeys(userID string) ([]models.APIKeyResponse, error) {
	var apiKeys []models.APIKey
	
	err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&apiKeys).Error
	if err != nil {
		return nil, fmt.Errorf("failed to fetch API keys: %w", err)
	}

	var responses []models.APIKeyResponse
	for _, key := range apiKeys {
		var permissions []string
		if key.Permissions != "" {
			if err := json.Unmarshal([]byte(key.Permissions), &permissions); err != nil {
				log.Printf("⚠️  Warning: Failed to parse permissions for key %s: %v", key.Name, err)
				permissions = []string{} // Default to empty permissions
			}
		}

		responses = append(responses, models.APIKeyResponse{
			ID:          key.ID,
			Name:        key.Name,
			UserID:      key.UserID,
			Description: key.Description,
			Permissions: permissions,
			IsActive:    key.IsActive,
			ExpiresAt:   key.ExpiresAt,
			LastUsedAt:  key.LastUsedAt,
			CreatedAt:   key.CreatedAt,
			UpdatedAt:   key.UpdatedAt,
			// Key is NOT included for security
		})
	}

	return responses, nil
}

// UpdateAPIKey updates an existing API key
func (s *APIKeyService) UpdateAPIKey(id uint, req models.UpdateAPIKeyRequest) error {
	var apiKey models.APIKey
	
	err := s.db.First(&apiKey, id).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("API key not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Update fields
	if req.Name != "" {
		apiKey.Name = req.Name
	}
	if req.Description != "" {
		apiKey.Description = req.Description
	}
	if req.IsActive != nil {
		apiKey.IsActive = *req.IsActive
	}
	if req.ExpiresAt != nil {
		apiKey.ExpiresAt = req.ExpiresAt
	}
	if req.Permissions != nil {
		permissionsJSON, err := json.Marshal(req.Permissions)
		if err != nil {
			return fmt.Errorf("failed to marshal permissions: %w", err)
		}
		apiKey.Permissions = string(permissionsJSON)
	}

	err = s.db.Save(&apiKey).Error
	if err != nil {
		return fmt.Errorf("failed to update API key: %w", err)
	}

	log.Printf("✅ Updated API key: %s", apiKey.Name)
	return nil
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
			return nil // Admin has all permissions
		}
		if perm == permission {
			return nil
		}
	}

	return fmt.Errorf("insufficient permissions: %s required", permission)
}

// CreateDefaultAPIKeys creates default API keys for development
func (s *APIKeyService) CreateDefaultAPIKeys() error {
	log.Println("🔑 Creating default API keys for development...")

	defaultKeys := []models.CreateAPIKeyRequest{
		{
			Name:        "Admin Key",
			UserID:      "admin",
			Description: "Full administrative access for admin user",
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
			Description: "Frontend application access for dashboard",
			Permissions: []string{
				models.PermissionRead,
				models.PermissionWrite,
				models.PermissionDataManage,
			},
		},
		{
			Name:        "Mobile App Key",
			UserID:      "mobile",
			Description: "Mobile application access (read-only)",
			Permissions: []string{
				models.PermissionRead,
				models.PermissionDataManage,
			},
		},
		{
			Name:        "Read Only Key",
			UserID:      "readonly",
			Description: "Read-only access for monitoring and analytics",
			Permissions: []string{
				models.PermissionRead,
			},
		},
	}

	createdCount := 0
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
		createdCount++
	}

	if createdCount > 0 {
		log.Printf("✅ Created %d default API keys", createdCount)
	} else {
		log.Println("ℹ️  All default API keys already exist")
	}

	return nil
}

// GetAPIKeyByID returns an API key by ID (without the actual key)
func (s *APIKeyService) GetAPIKeyByID(id uint) (*models.APIKeyResponse, error) {
	var apiKey models.APIKey
	
	err := s.db.First(&apiKey, id).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("API key not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	var permissions []string
	if apiKey.Permissions != "" {
		if err := json.Unmarshal([]byte(apiKey.Permissions), &permissions); err != nil {
			log.Printf("⚠️  Warning: Failed to parse permissions for key %s: %v", apiKey.Name, err)
			permissions = []string{}
		}
	}

	return &models.APIKeyResponse{
		ID:          apiKey.ID,
		Name:        apiKey.Name,
		UserID:      apiKey.UserID,
		Description: apiKey.Description,
		Permissions: permissions,
		IsActive:    apiKey.IsActive,
		ExpiresAt:   apiKey.ExpiresAt,
		LastUsedAt:  apiKey.LastUsedAt,
		CreatedAt:   apiKey.CreatedAt,
		UpdatedAt:   apiKey.UpdatedAt,
		// Key is NOT included for security
	}, nil
}

// CountAPIKeys returns the count of API keys for a user
func (s *APIKeyService) CountAPIKeys(userID string) (int64, error) {
	var count int64
	err := s.db.Model(&models.APIKey{}).Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to count API keys: %w", err)
	}
	return count, nil
}

// DeactivateExpiredKeys deactivates all expired API keys
func (s *APIKeyService) DeactivateExpiredKeys() (int, error) {
	now := time.Now()
	result := s.db.Model(&models.APIKey{}).
		Where("expires_at IS NOT NULL AND expires_at < ? AND is_active = ?", now, true).
		Update("is_active", false)

	if result.Error != nil {
		return 0, fmt.Errorf("failed to deactivate expired keys: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		log.Printf("🧹 Deactivated %d expired API keys", result.RowsAffected)
	}

	return int(result.RowsAffected), nil
}

// GetStats returns API key statistics
func (s *APIKeyService) GetStats() (map[string]interface{}, error) {
	var totalKeys int64
	var activeKeys int64
	var expiredKeys int64

	// Count total keys
	if err := s.db.Model(&models.APIKey{}).Count(&totalKeys).Error; err != nil {
		return nil, fmt.Errorf("failed to count total keys: %w", err)
	}

	// Count active keys
	if err := s.db.Model(&models.APIKey{}).Where("is_active = ?", true).Count(&activeKeys).Error; err != nil {
		return nil, fmt.Errorf("failed to count active keys: %w", err)
	}

	// Count expired keys
	now := time.Now()
	if err := s.db.Model(&models.APIKey{}).
		Where("expires_at IS NOT NULL AND expires_at < ?", now).
		Count(&expiredKeys).Error; err != nil {
		return nil, fmt.Errorf("failed to count expired keys: %w", err)
	}

	// Get users with keys
	var users []string
	if err := s.db.Model(&models.APIKey{}).
		Distinct("user_id").
		Pluck("user_id", &users).Error; err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}

	stats := map[string]interface{}{
		"total_keys":    totalKeys,
		"active_keys":   activeKeys,
		"inactive_keys": totalKeys - activeKeys,
		"expired_keys":  expiredKeys,
		"total_users":   len(users),
		"users":         users,
	}

	return stats, nil
}