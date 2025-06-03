// backend/controllers/route_controller.go (FIXED)
package controllers

import (
	"strconv"
	"time"

	"apisix-backend/service"  // แก้ไข import path

	"github.com/gofiber/fiber/v2"
)

// RouteController handles route management operations
type RouteController struct {
	routeService *services.RouteService
}

// NewRouteController creates a new RouteController instance
func NewRouteController() *RouteController {
	// Use the mounted volume path for development
	configPath := "/app/apisix.yaml" // This should be mounted from ./apisix/apisix.yaml
	
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
		"list":  routeList,
		"total": len(routeList),
		"count": len(routeList),
		"status": "success",
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
		"list":  upstreamList,
		"total": len(upstreamList),
		"count": len(upstreamList),
		"status": "success",
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
			"error":   "Failed to create route",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Route created successfully",
		"data":    req,
		"status":  "success",
		"note":    "APISIX container restart may be required for changes to take effect",
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
			"error":   "Route not found",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return c.JSON(fiber.Map{
		"data":   route,
		"status": "success",
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
			"error":   "Failed to update route",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Route updated successfully",
		"data":    req,
		"status":  "success",
		"note":    "APISIX container restart may be required for changes to take effect",
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
			"error":   "Failed to delete route",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Route deleted successfully",
		"status":  "success",
		"note":    "APISIX container restart may be required for changes to take effect",
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
			"error":   "Failed to create quick route",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Quick route created successfully",
		"data":    req,
		"status":  "success",
		"note":    "APISIX container restart may be required for changes to take effect",
	})
}

// ReloadAPISIX - POST /api/routes/reload - รีโหลด APISIX configuration
func (rc *RouteController) ReloadAPISIX(c *fiber.Ctx) error {
	err := rc.routeService.ReloadAPISIX()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to reload APISIX",
			"message": err.Error(),
			"status":  "error",
		})
	}

	return c.JSON(fiber.Map{
		"message": "APISIX reload initiated",
		"status":  "success",
		"note":    "Configuration changes will take effect after container restart",
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
			"plugins": map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
				},
			},
		},
	}

	return c.JSON(fiber.Map{
		"templates": templates,
		"status":    "success",
	})
}