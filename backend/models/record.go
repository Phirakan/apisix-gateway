package models

import (
	"time"
)

// Record represents a simple data record
type Record struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:255;not null"`
	Value     string    `json:"value" gorm:"size:500"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateRecordRequest represents the request body for creating a record
type CreateRecordRequest struct {
	Name  string `json:"name" validate:"required"`
	Value string `json:"value"`
}

// UpdateRecordRequest represents the request body for updating a record
type UpdateRecordRequest struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}