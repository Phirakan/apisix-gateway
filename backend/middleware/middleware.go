package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// SetupMiddleware ตั้งค่า middleware ทั้งหมด
func SetupMiddleware(app *fiber.App) {
	// Recover middleware - จัดการ panic
	app.Use(recover.New(recover.Config{
		EnableStackTrace: true,
	}))

	// Logger middleware - log requests
	app.Use(logger.New(logger.Config{
		Format:     "[${time}] ${status} - ${method} ${path} - ${latency} - ${ip}\n",
		TimeFormat: "2006-01-02 15:04:05",
		TimeZone:   "Local",
	}))

	// CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-API-Key",
		ExposeHeaders:    "Content-Length,X-Total-Count",
		AllowCredentials: false,
		MaxAge:           300, // 5 minutes
	}))

	// Rate limiting middleware
	app.Use(limiter.New(limiter.Config{
		Max:               100,              // จำกัด 100 requests
		Expiration:        1 * time.Minute, // ต่อ 1 นาที
		LimiterMiddleware: limiter.SlidingWindow{},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "Too many requests",
				"message": "Rate limit exceeded. Please try again later.",
				"status":  "error",
			})
		},
	}))
}

// APIKeyAuth middleware สำหรับการตรวจสอบ API key
func APIKeyAuth(validKeys []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// ข้าม API key check สำหรับ health check และ root endpoint
		if c.Path() == "/api/health" || c.Path() == "/" {
			return c.Next()
		}

		// ดึง API key จาก header
		apiKey := c.Get("X-API-Key")
		if apiKey == "" {
			apiKey = c.Get("apikey") // รองรับ format อื่น
		}

		if apiKey == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "API key required",
				"message": "Please provide a valid API key in X-API-Key header",
				"status":  "error",
			})
		}

		// ตรวจสอบว่า API key ถูกต้องหรือไม่
		isValid := false
		for _, validKey := range validKeys {
			if apiKey == validKey {
				isValid = true
				break
			}
		}

		if !isValid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Invalid API key",
				"message": "The provided API key is not valid",
				"status":  "error",
			})
		}

		return c.Next()
	}
}

// RequestID middleware สำหรับสร้าง unique request ID
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// สร้าง request ID
		requestID := generateRequestID()
		
		// เก็บ request ID ใน context
		c.Locals("requestId", requestID)
		
		// เพิ่ม request ID ใน response header
		c.Set("X-Request-ID", requestID)
		
		return c.Next()
	}
}

// SecurityHeaders middleware สำหรับเพิ่ม security headers
func SecurityHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Security headers
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		
		return c.Next()
	}
}

// JSONOnly middleware สำหรับบังคับให้ request เป็น JSON เท่านั้น
func JSONOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// ข้าม check สำหรับ GET requests
		if c.Method() == "GET" || c.Method() == "DELETE" {
			return c.Next()
		}

		contentType := c.Get("Content-Type")
		if contentType != "application/json" && contentType != "" {
			return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{
				"error":   "Unsupported media type",
				"message": "Content-Type must be application/json",
				"status":  "error",
			})
		}

		return c.Next()
	}
}

// ValidateContentLength middleware สำหรับจำกัดขนาด request body
func ValidateContentLength(maxSize int64) fiber.Handler {
	return func(c *fiber.Ctx) error {
		contentLength := c.Request().Header.ContentLength()
		
		if int64(contentLength) > maxSize {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error":   "Request entity too large",
				"message": "Request body size exceeds the limit",
				"status":  "error",
			})
		}

		return c.Next()
	}
}

// generateRequestID สร้าง unique request ID
func generateRequestID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

// randomString สร้าง random string
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}