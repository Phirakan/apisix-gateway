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

	// API group
	api := app.Group("/api")

	// Health check endpoint
	api.Get("/health", recordController.GetHealth)

	// Data routes group
	data := api.Group("/data")
	
	// Basic CRUD routes
	data.Get("/", recordController.GetAllRecords)           // GET /api/data
	data.Post("/", recordController.CreateRecord)           // POST /api/data
	data.Get("/:id", recordController.GetRecordByID)        // GET /api/data/:id
	data.Put("/:id", recordController.UpdateRecord)         // PUT /api/data/:id
	data.Delete("/:id", recordController.DeleteRecord)      // DELETE /api/data/:id
	
	// Advanced routes
	data.Get("/paginated", recordController.GetRecordsPaginated) // GET /api/data/paginated
	data.Post("/bulk", recordController.BulkCreateRecords)       // POST /api/data/bulk

	// Root endpoint
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Welcome to APISIX GoFiber Backend",
			"version": "1.0.0",
			"endpoints": fiber.Map{
				"health":      "GET /api/health",
				"data":        "GET|POST /api/data",
				"data_by_id":  "GET|PUT|DELETE /api/data/:id",
				"paginated":   "GET /api/data/paginated?page=1&limit=10&search=keyword",
				"bulk_create": "POST /api/data/bulk",
			},
		})
	})
}