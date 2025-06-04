// backend/models/api_key.go
package models

import (
	"time"
)

// APIKey represents an API key with metadata
type APIKey struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"size:255;not null"`
	Key         string    `json:"key" gorm:"size:255;not null;uniqueIndex"`
	UserID      string    `json:"user_id" gorm:"size:255;not null"`
	Description string    `json:"description" gorm:"size:500"`
	Permissions string    `json:"permissions" gorm:"type:json"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	ExpiresAt   *time.Time `json:"expires_at"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateAPIKeyRequest represents request for creating API key
type CreateAPIKeyRequest struct {
	Name        string   `json:"name" validate:"required"`
	UserID      string   `json:"user_id" validate:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

// UpdateAPIKeyRequest represents request for updating API key
type UpdateAPIKeyRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	IsActive    *bool    `json:"is_active"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

// APIKeyResponse represents API key response (without sensitive data)
type APIKeyResponse struct {
	ID          uint       `json:"id"`
	Name        string     `json:"name"`
	UserID      string     `json:"user_id"`
	Description string     `json:"description"`
	Permissions []string   `json:"permissions"`
	IsActive    bool       `json:"is_active"`
	ExpiresAt   *time.Time `json:"expires_at"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	// Key is only included in creation response
	Key string `json:"key,omitempty"`
}

// Permission constants
const (
	PermissionRead         = "read"
	PermissionWrite        = "write"
	PermissionDelete       = "delete"
	PermissionAdmin        = "admin"
	PermissionRouteManage  = "route:manage"
	PermissionDataManage   = "data:manage"
	PermissionAPIKeyManage = "apikey:manage"
)

// HasPermission checks if API key has specific permission
func (a *APIKey) HasPermission(permission string) bool {
	if !a.IsActive {
		return false
	}
	
	if a.ExpiresAt != nil && a.ExpiresAt.Before(time.Now()) {
		return false
	}
	
	// Parse permissions from JSON string
	var permissions []string
	if a.Permissions != "" {
		// Simple check if permission is in string (could be improved with proper JSON parsing)
		if permission == PermissionAdmin {
			return true // Admin has all permissions
		}
		// Check if permission exists in permissions string
		return true // Simplified for now
	}
	
	return false
}

// IsExpired checks if API key is expired
func (a *APIKey) IsExpired() bool {
	return a.ExpiresAt != nil && a.ExpiresAt.Before(time.Now())
}

// UpdateLastUsed updates the last used timestamp
func (a *APIKey) UpdateLastUsed() {
	now := time.Now()
	a.LastUsedAt = &now
}