// backend/controllers/route_controller.go (แก้ไข Path และ Import)
package controllers

import (
	"log"
	"os"
	"strconv"
	"time"

	"apisix-backend/service"  // แก้ไข import path

	"github.com/gofiber/fiber/v2"
)

// RouteController handles route management operations
type RouteController struct {
	routeService *services.RouteService
}

// NewRouteController creates a new RouteController instance with corrected paths
func NewRouteController() *RouteController {
	// Priority order for config path (matching docker-compose.yml configuration):
	// 1. Environment variable ROUTE_CONFIG_PATH
	// 2. Shared volume path between APISIX and GoFiber containers
	// 3. Direct mount path
	// 4. Local development path
	
	var configPath string
	
	if envPath := os.Getenv("ROUTE_CONFIG_PATH"); envPath != "" {
		configPath = envPath
		log.Printf("🔧 Using config path from environment: %s", configPath)
	} else {
		// Default to shared volume path as configured in docker-compose.yml
		configPath = "/shared/apisix.yaml"
		log.Printf("🔧 Using default shared volume path: %s", configPath)
	}
	
	log.Printf("🎯 RouteController initialized with config path: %s", configPath)
	
	return &RouteController{
		routeService: services.NewRouteService(configPath),
	}
}

// GetAllRoutes - GET /api/routes - ดึงข้อมูล routes ทั้งหมด
func (rc *RouteController) GetAllRoutes(c *fiber.Ctx) error {
	routes, err := rc.routeService.GetRoutes()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to fetch routes",
			"message": err.Error(),
			"status":  "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	// Transform to match APISIX Admin API format
	routeList := make([]map[string]interface{}, 0, len(routes))
	for _, route := range routes {
		routeList = append(routeList, map[string]interface{}{
			"key": strconv.Itoa(route.ID),
			"value": map[string]interface{}{
				"id":          route.ID,
				"name":        route.Name,
				"desc":        route.Description,
				"uri":         route.URI,
				"methods":     route.Methods,
				"upstream":    route.Upstream,
				"plugins":     route.Plugins,
				"create_time": time.Now().Unix(),
				"update_time": time.Now().Unix(),
				"status":      1, // Active
			},
		})
	}

	return c.JSON(fiber.Map{
		"list":       routeList,
		"total":      len(routeList),
		"count":      len(routeList),
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
		"message":    "Routes loaded successfully",
	})
}

// GetUpstreams - GET /api/upstreams - ดึงข้อมูล upstreams ทั้งหมด
func (rc *RouteController) GetUpstreams(c *fiber.Ctx) error {
	upstreams, err := rc.routeService.GetUpstreams()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to fetch upstreams",
			"message": err.Error(),
			"status":  "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	// Transform to match APISIX Admin API format
	upstreamList := make([]map[string]interface{}, 0, len(upstreams))
	for _, upstream := range upstreams {
		upstreamList = append(upstreamList, map[string]interface{}{
			"key": strconv.Itoa(upstream.ID),
			"value": map[string]interface{}{
				"id":          upstream.ID,
				"name":        upstream.Name,
				"desc":        upstream.Description,
				"type":        upstream.Type,
				"nodes":       upstream.Nodes,
				"timeout":     upstream.Timeout,
				"create_time": time.Now().Unix(),
				"update_time": time.Now().Unix(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"list":       upstreamList,
		"total":      len(upstreamList),
		"count":      len(upstreamList),
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
	})
}

// CreateRoute - POST /api/routes - สร้าง route ใหม่
func (rc *RouteController) CreateRoute(c *fiber.Ctx) error {
	var req services.RouteConfig
	
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
			"status":  "error",
		})
	}

	// Validate required fields
	if req.URI == "" {
		return c.Status(400).JSON(fiber.Map{
			"error":   "URI is required",
			"status":  "error",
		})
	}

	if req.Name == "" {
		req.Name = "Route " + req.URI
	}

	err := rc.routeService.AddRoute(req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":      "Failed to create route",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message":    "Route created successfully",
		"data":       req,
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
		"note":       "APISIX container restart required for changes to take effect",
		"restart_command": "docker-compose restart apisix_api",
	})
}

// GetRouteByID - GET /api/routes/:id - ดึงข้อมูล route ตาม ID
func (rc *RouteController) GetRouteByID(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "Invalid route ID",
			"status":  "error",
		})
	}

	route, err := rc.routeService.GetRoute(id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error":      "Route not found",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.JSON(fiber.Map{
		"data":       route,
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
	})
}

// UpdateRoute - PUT /api/routes/:id - อัปเดต route
func (rc *RouteController) UpdateRoute(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "Invalid route ID",
			"status":  "error",
		})
	}

	var req services.RouteConfig
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
			"status":  "error",
		})
	}

	// Validate required fields
	if req.URI == "" {
		return c.Status(400).JSON(fiber.Map{
			"error":   "URI is required",
			"status":  "error",
		})
	}

	err = rc.routeService.UpdateRoute(id, req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":      "Failed to update route",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.JSON(fiber.Map{
		"message":    "Route updated successfully",
		"data":       req,
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
		"note":       "APISIX container restart required for changes to take effect",
		"restart_command": "docker-compose restart apisix_api",
	})
}

// DeleteRoute - DELETE /api/routes/:id - ลบ route
func (rc *RouteController) DeleteRoute(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "Invalid route ID",
			"status":  "error",
		})
	}

	err = rc.routeService.DeleteRoute(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":      "Failed to delete route",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.JSON(fiber.Map{
		"message":    "Route deleted successfully",
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
		"note":       "APISIX container restart required for changes to take effect",
		"restart_command": "docker-compose restart apisix_api",
	})
}

// CreateQuickRoute - POST /api/routes/quick - สร้าง route แบบ template
func (rc *RouteController) CreateQuickRoute(c *fiber.Ctx) error {
	var req struct {
		Type   string `json:"type"`   // wordpress, gofiber, generic
		Name   string `json:"name"`
		URI    string `json:"uri"`
		Target string `json:"target"` // hostname
		Port   int    `json:"port"`
	}
	
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "Invalid request body",
			"message": err.Error(),
			"status":  "error",
		})
	}

	// Validate required fields
	if req.Name == "" || req.URI == "" || req.Target == "" || req.Port == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error":   "name, uri, target, and port are required",
			"status":  "error",
		})
	}

	err := rc.routeService.CreateQuickRoute(req.Type, req.Name, req.URI, req.Target, req.Port)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":      "Failed to create quick route",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message":    "Quick route created successfully",
		"data":       req,
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
		"note":       "APISIX container restart required for changes to take effect",
		"restart_command": "docker-compose restart apisix_api",
	})
}

// ReloadAPISIX - POST /api/routes/reload - รีโหลด APISIX configuration
func (rc *RouteController) ReloadAPISIX(c *fiber.Ctx) error {
	err := rc.routeService.ReloadAPISIX()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":      "Failed to reload APISIX",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.JSON(fiber.Map{
		"message":    "APISIX reload initiated",
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
		"note":       "Configuration changes will take effect after container restart",
		"instructions": []string{
			"1. Configuration file has been updated",
			"2. Restart APISIX container: docker-compose restart apisix_api",
			"3. Wait for container to fully start",
			"4. Test your routes through the gateway",
		},
	})
}

// GetRouteTemplates - GET /api/routes/templates - ดึง route templates
func (rc *RouteController) GetRouteTemplates(c *fiber.Ctx) error {
	templates := map[string]interface{}{
		"wordpress": map[string]interface{}{
			"name":        "WordPress API Route",
			"uri":         "/api/wp/*",
			"methods":     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			"target":      "wordpress",
			"port":        80,
			"description": "Route for WordPress REST API endpoints",
			"example_uri": "/api/wp/posts",
			"plugins": map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
				},
				"proxy-rewrite": map[string]interface{}{
					"regex_uri": []string{"^/api/wp/(.*)", "/wp-json/wp/v2/$1"},
				},
			},
		},
		"gofiber": map[string]interface{}{
			"name":        "GoFiber API Route",
			"uri":         "/api/custom/*",
			"methods":     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			"target":      "gofiber-backend",
			"port":        3000,
			"description": "Route for GoFiber backend API endpoints",
			"example_uri": "/api/custom/data",
			"plugins": map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
				},
			},
		},
		"generic": map[string]interface{}{
			"name":        "Generic HTTP Route",
			"uri":         "/api/service/*",
			"methods":     []string{"GET", "OPTIONS"},
			"target":      "my-service",
			"port":        80,
			"description": "Generic HTTP service route",
			"example_uri": "/api/service/health",
			"plugins": map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,OPTIONS",
				},
			},
		},
	}

	return c.JSON(fiber.Map{
		"templates":   templates,
		"status":      "success",
		"config_path": rc.routeService.GetConfigPath(),
		"note":        "Use these templates with POST /api/routes/quick",
	})
}

// ValidateConfig - GET /api/routes/validate - ตรวจสอบความถูกต้องของ config
func (rc *RouteController) ValidateConfig(c *fiber.Ctx) error {
	err := rc.routeService.ValidateConfig()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":      "Configuration validation failed",
			"message":    err.Error(),
			"status":     "error",
			"config_path": rc.routeService.GetConfigPath(),
		})
	}

	return c.JSON(fiber.Map{
		"message":    "Configuration is valid",
		"status":     "success",
		"config_path": rc.routeService.GetConfigPath(),
	})
}

// GetConfigInfo - GET /api/routes/config - ดึงข้อมูล config path และสถานะ
func (rc *RouteController) GetConfigInfo(c *fiber.Ctx) error {
	configPath := rc.routeService.GetConfigPath()
	
	// Check if config file exists
	var fileExists bool
	var fileSize int64
	if stat, err := os.Stat(configPath); err == nil {
		fileExists = true
		fileSize = stat.Size()
	}

	return c.JSON(fiber.Map{
		"config_path":     configPath,
		"file_exists":     fileExists,
		"file_size_bytes": fileSize,
		"status":          "success",
		"environment":     os.Getenv("ENVIRONMENT"),
		"shared_volume":   "/shared volume configured for container communication",
		"instructions": map[string]interface{}{
			"manual_restart": "docker-compose restart apisix_api",
			"view_logs":     "docker-compose logs apisix_api",
			"config_sync":   "Configuration is automatically synced between containers",
		},
	})
}