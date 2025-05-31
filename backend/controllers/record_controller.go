package controllers

import (
	"time"

	"apisix-backend/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type RecordController struct {
	db *gorm.DB
}

// NewRecordController สร้าง instance ใหม่ของ RecordController
func NewRecordController(db *gorm.DB) *RecordController {
	return &RecordController{
		db: db,
	}
}

// GetHealth - Health check endpoint
func (rc *RecordController) GetHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "ok",
		"message": "GoFiber backend is running",
		"time":    time.Now(),
	})
}

// GetAllRecords - GET /api/data - ดึงข้อมูล records ทั้งหมด
func (rc *RecordController) GetAllRecords(c *fiber.Ctx) error {
	var records []models.Record
	result := rc.db.Find(&records)
	
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch records",
		})
	}

	return c.JSON(fiber.Map{
		"data":  records,
		"count": len(records),
		"status": "success",
	})
}

// CreateRecord - POST /api/data - สร้าง record ใหม่
func (rc *RecordController) CreateRecord(c *fiber.Ctx) error {
	var req models.CreateRecordRequest
	
	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "Name is required",
		})
	}

	// สร้าง record ใหม่
	record := models.Record{
		Name:  req.Name,
		Value: req.Value,
	}

	result := rc.db.Create(&record)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to create record",
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Record created successfully",
		"data":    record,
		"status":  "success",
	})
}

// GetRecordByID - GET /api/data/:id - ดึงข้อมูล record ตาม ID
func (rc *RecordController) GetRecordByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var record models.Record

	result := rc.db.First(&record, id)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{
				"error": "Record not found",
			})
		}
		return c.Status(500).JSON(fiber.Map{
			"error": "Database error",
		})
	}

	return c.JSON(fiber.Map{
		"data":   record,
		"status": "success",
	})
}

// UpdateRecord - PUT /api/data/:id - อัปเดต record
func (rc *RecordController) UpdateRecord(c *fiber.Ctx) error {
	id := c.Params("id")
	var record models.Record
	var req models.UpdateRecordRequest

	// ตรวจสอบว่า record มีอยู่หรือไม่
	result := rc.db.First(&record, id)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{
				"error": "Record not found",
			})
		}
		return c.Status(500).JSON(fiber.Map{
			"error": "Database error",
		})
	}

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// อัปเดตข้อมูลเฉพาะ field ที่ส่งมา
	if req.Name != "" {
		record.Name = req.Name
	}
	if req.Value != "" {
		record.Value = req.Value
	}

	// บันทึกการเปลี่ยนแปลง
	if err := rc.db.Save(&record).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to update record",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Record updated successfully",
		"data":    record,
		"status":  "success",
	})
}

// DeleteRecord - DELETE /api/data/:id - ลบ record
func (rc *RecordController) DeleteRecord(c *fiber.Ctx) error {
	id := c.Params("id")
	var record models.Record

	// ตรวจสอบว่า record มีอยู่หรือไม่
	result := rc.db.First(&record, id)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{
				"error": "Record not found",
			})
		}
		return c.Status(500).JSON(fiber.Map{
			"error": "Database error",
		})
	}

	// ลบ record
	if err := rc.db.Delete(&record).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to delete record",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Record deleted successfully",
		"status":  "success",
	})
}

// GetRecordsPaginated - GET /api/data/paginated - ดึงข้อมูลแบบแบ่งหน้า
func (rc *RecordController) GetRecordsPaginated(c *fiber.Ctx) error {
	// รับค่า query parameters
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	search := c.Query("search", "")

	// คำนวณ offset
	offset := (page - 1) * limit

	var records []models.Record
	var total int64
	
	query := rc.db.Model(&models.Record{})
	
	// ถ้ามีการค้นหา
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name LIKE ? OR value LIKE ?", searchPattern, searchPattern)
	}

	// นับจำนวนรวม
	query.Count(&total)

	// ดึงข้อมูลตาม pagination
	result := query.Offset(offset).Limit(limit).Find(&records)
	
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch records",
		})
	}

	// คำนวณจำนวนหน้า
	totalPages := (total + int64(limit) - 1) / int64(limit)

	return c.JSON(fiber.Map{
		"data": records,
		"pagination": fiber.Map{
			"current_page": page,
			"per_page":     limit,
			"total":        total,
			"total_pages":  totalPages,
			"has_next":     page < int(totalPages),
			"has_prev":     page > 1,
		},
		"status": "success",
	})
}

// BulkCreateRecords - POST /api/data/bulk - สร้างหลาย records พร้อมกัน
func (rc *RecordController) BulkCreateRecords(c *fiber.Ctx) error {
	var requests []models.CreateRecordRequest
	
	// Parse request body
	if err := c.BodyParser(&requests); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if len(requests) == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "No records to create",
		})
	}

	// แปลง requests เป็น records
	var records []models.Record
	for _, req := range requests {
		if req.Name == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "All records must have a name",
			})
		}
		
		records = append(records, models.Record{
			Name:  req.Name,
			Value: req.Value,
		})
	}

	// สร้าง records ทั้งหมดใน transaction
	if err := rc.db.Create(&records).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to create records",
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Records created successfully",
		"data":    records,
		"count":   len(records),
		"status":  "success",
	})
}