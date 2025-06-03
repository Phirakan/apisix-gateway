// backend/services/route_service.go (แก้ไข File Handling)
package services

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"sync"
	"time"

	"gopkg.in/yaml.v2"
)

// RouteConfig represents a single route configuration
type RouteConfig struct {
	ID          int                    `yaml:"id" json:"id"`
	Name        string                 `yaml:"name" json:"name"`
	Description string                 `yaml:"desc,omitempty" json:"description,omitempty"`
	URI         string                 `yaml:"uri" json:"uri"`
	Methods     []string              `yaml:"methods" json:"methods"`
	Upstream    UpstreamConfig        `yaml:"upstream" json:"upstream"`
	Plugins     map[string]interface{} `yaml:"plugins,omitempty" json:"plugins,omitempty"`
}

// UpstreamConfig represents upstream configuration
type UpstreamConfig struct {
	Type    string            `yaml:"type" json:"type"`
	Nodes   map[string]int    `yaml:"nodes" json:"nodes"`
	Timeout *TimeoutConfig    `yaml:"timeout,omitempty" json:"timeout,omitempty"`
}

// TimeoutConfig represents timeout settings
type TimeoutConfig struct {
	Connect int `yaml:"connect" json:"connect"`
	Send    int `yaml:"send" json:"send"`
	Read    int `yaml:"read" json:"read"`
}

// UpstreamDefinition represents standalone upstream
type UpstreamDefinition struct {
	ID          int            `yaml:"id" json:"id"`
	Name        string         `yaml:"name" json:"name"`
	Description string         `yaml:"desc,omitempty" json:"description,omitempty"`
	Type        string         `yaml:"type" json:"type"`
	Nodes       map[string]int `yaml:"nodes" json:"nodes"`
	Timeout     *TimeoutConfig `yaml:"timeout,omitempty" json:"timeout,omitempty"`
}

// APISIXConfig represents the entire APISIX configuration
type APISIXConfig struct {
	Routes    []RouteConfig        `yaml:"routes" json:"routes"`
	Upstreams []UpstreamDefinition `yaml:"upstreams" json:"upstreams"`
}

// RouteService handles route management operations
type RouteService struct {
	configPath string
	mutex      sync.RWMutex // เพิ่ม mutex สำหรับ thread safety
}

// NewRouteService creates a new RouteService instance
func NewRouteService(configPath string) *RouteService {
	if configPath == "" {
		configPath = "/app/apisix.yaml"
	}
	
	log.Printf("📁 Route service initialized with config path: %s", configPath)
	
	return &RouteService{
		configPath: configPath,
	}
}

// GetRoutes reads and returns all routes from APISIX config
func (rs *RouteService) GetRoutes() ([]RouteConfig, error) {
	rs.mutex.RLock()
	defer rs.mutex.RUnlock()
	
	log.Println("📖 Reading routes from configuration...")
	
	config, err := rs.readConfigUnsafe()
	if err != nil {
		log.Printf("❌ Failed to read routes config: %v", err)
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	
	log.Printf("✅ Successfully loaded %d routes", len(config.Routes))
	return config.Routes, nil
}

// GetUpstreams reads and returns all upstreams from APISIX config
func (rs *RouteService) GetUpstreams() ([]UpstreamDefinition, error) {
	rs.mutex.RLock()
	defer rs.mutex.RUnlock()
	
	log.Println("📖 Reading upstreams from configuration...")
	
	config, err := rs.readConfigUnsafe()
	if err != nil {
		log.Printf("❌ Failed to read upstreams config: %v", err)
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	
	log.Printf("✅ Successfully loaded %d upstreams", len(config.Upstreams))
	return config.Upstreams, nil
}

// AddRoute adds a new route to the configuration
func (rs *RouteService) AddRoute(route RouteConfig) error {
	rs.mutex.Lock()
	defer rs.mutex.Unlock()
	
	log.Printf("➕ Adding new route: %s", route.Name)
	
	config, err := rs.readConfigUnsafe()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	// Auto-generate ID if not provided
	if route.ID == 0 {
		route.ID = rs.getNextRouteID(config.Routes)
		log.Printf("🔢 Auto-generated route ID: %d", route.ID)
	}

	// Check for duplicate ID
	for _, existing := range config.Routes {
		if existing.ID == route.ID {
			return fmt.Errorf("route with ID %d already exists", route.ID)
		}
	}

	// Set default values if not provided
	if route.Methods == nil || len(route.Methods) == 0 {
		route.Methods = []string{"GET"}
		log.Println("🔧 Set default HTTP methods: [GET]")
	}
	if route.Upstream.Type == "" {
		route.Upstream.Type = "roundrobin"
		log.Println("🔧 Set default upstream type: roundrobin")
	}

	// Add default timeout if not provided
	if route.Upstream.Timeout == nil {
		route.Upstream.Timeout = &TimeoutConfig{
			Connect: 6,
			Send:    6,
			Read:    6,
		}
		log.Println("🔧 Set default timeouts: 6s each")
	}

	// Add the new route
	config.Routes = append(config.Routes, route)
	
	err = rs.writeConfigUnsafe(config)
	if err != nil {
		log.Printf("❌ Failed to write config after adding route: %v", err)
		return err
	}
	
	log.Printf("✅ Successfully added route: %s (ID: %d)", route.Name, route.ID)
	return nil
}

// UpdateRoute updates an existing route
func (rs *RouteService) UpdateRoute(id int, updatedRoute RouteConfig) error {
	rs.mutex.Lock()
	defer rs.mutex.Unlock()
	
	log.Printf("🔄 Updating route ID: %d", id)
	
	config, err := rs.readConfigUnsafe()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	// Find and update the route
	found := false
	for i, route := range config.Routes {
		if route.ID == id {
			updatedRoute.ID = id // Ensure ID doesn't change
			config.Routes[i] = updatedRoute
			found = true
			log.Printf("🔄 Found and updated route: %s", updatedRoute.Name)
			break
		}
	}

	if !found {
		return fmt.Errorf("route with ID %d not found", id)
	}

	err = rs.writeConfigUnsafe(config)
	if err != nil {
		log.Printf("❌ Failed to write config after updating route: %v", err)
		return err
	}
	
	log.Printf("✅ Successfully updated route ID: %d", id)
	return nil
}

// DeleteRoute removes a route from the configuration
func (rs *RouteService) DeleteRoute(id int) error {
	rs.mutex.Lock()
	defer rs.mutex.Unlock()
	
	log.Printf("🗑️ Deleting route ID: %d", id)
	
	config, err := rs.readConfigUnsafe()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	// Find and remove the route
	newRoutes := make([]RouteConfig, 0, len(config.Routes))
	found := false
	var deletedRouteName string
	
	for _, route := range config.Routes {
		if route.ID != id {
			newRoutes = append(newRoutes, route)
		} else {
			found = true
			deletedRouteName = route.Name
		}
	}

	if !found {
		return fmt.Errorf("route with ID %d not found", id)
	}

	config.Routes = newRoutes
	
	err = rs.writeConfigUnsafe(config)
	if err != nil {
		log.Printf("❌ Failed to write config after deleting route: %v", err)
		return err
	}
	
	log.Printf("✅ Successfully deleted route: %s (ID: %d)", deletedRouteName, id)
	return nil
}

// GetRoute returns a specific route by ID
func (rs *RouteService) GetRoute(id int) (*RouteConfig, error) {
	rs.mutex.RLock()
	defer rs.mutex.RUnlock()
	
	log.Printf("🔍 Looking for route ID: %d", id)
	
	config, err := rs.readConfigUnsafe()
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	for _, route := range config.Routes {
		if route.ID == id {
			log.Printf("✅ Found route: %s (ID: %d)", route.Name, id)
			return &route, nil
		}
	}

	log.Printf("❌ Route with ID %d not found", id)
	return nil, fmt.Errorf("route with ID %d not found", id)
}

// readConfigUnsafe reads the APISIX configuration file (ไม่มี mutex lock)
func (rs *RouteService) readConfigUnsafe() (*APISIXConfig, error) {
	log.Printf("📖 Reading config from: %s", rs.configPath)
	
	// Check if file exists
	if _, err := os.Stat(rs.configPath); os.IsNotExist(err) {
		log.Printf("⚠️  Config file doesn't exist, creating default: %s", rs.configPath)
		// Create default config
		defaultConfig := &APISIXConfig{
			Routes:    []RouteConfig{},
			Upstreams: []UpstreamDefinition{},
		}
		err := rs.writeConfigUnsafe(defaultConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
		return defaultConfig, nil
	}
	
	data, err := ioutil.ReadFile(rs.configPath)
	if err != nil {
		log.Printf("❌ Failed to read config file: %v", err)
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config APISIXConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		log.Printf("❌ Failed to parse YAML: %v", err)
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	log.Printf("✅ Successfully parsed config: %d routes, %d upstreams", 
		len(config.Routes), len(config.Upstreams))
	return &config, nil
}

// writeConfigUnsafe writes the configuration back to the file (ไม่มี mutex lock)
func (rs *RouteService) writeConfigUnsafe(config *APISIXConfig) error {
	log.Printf("💾 Writing config to: %s", rs.configPath)
	
	// Create backup before writing
	rs.createBackupUnsafe()
	
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	// สำหรับ mounted volumes, ใช้วิธี direct write แทน rename
	// เพื่อหลีกเลี่ยง "device or resource busy" error
	err = rs.writeFileSafely(rs.configPath, data)
	if err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	log.Printf("✅ Successfully wrote config to: %s", rs.configPath)
	return nil
}

// writeFileSafely เขียนไฟล์อย่างปลอดภัยสำหรับ mounted volumes
func (rs *RouteService) writeFileSafely(filepath string, data []byte) error {
	// ลองใช้ temporary file approach ก่อน
	tempFile := filepath + ".tmp"
	
	// เขียนไปยัง temp file
	err := ioutil.WriteFile(tempFile, data, 0644)
	if err != nil {
		log.Printf("⚠️  Temp file write failed, trying direct write: %v", err)
		// ถ้า temp file ไม่ได้ ให้เขียนตรงไปยังไฟล์เดิม
		return ioutil.WriteFile(filepath, data, 0644)
	}

	// ลอง rename
	err = os.Rename(tempFile, filepath)
	if err != nil {
		log.Printf("⚠️  Rename failed, using direct copy: %v", err)
		
		// อ่านจาก temp file และเขียนไปยังไฟล์เดิม
		tempData, readErr := ioutil.ReadFile(tempFile)
		if readErr != nil {
			os.Remove(tempFile) // ลบ temp file
			return fmt.Errorf("failed to read temp file: %w", readErr)
		}
		
		writeErr := ioutil.WriteFile(filepath, tempData, 0644)
		os.Remove(tempFile) // ลบ temp file เสมอ
		
		if writeErr != nil {
			return fmt.Errorf("failed to write to target file: %w", writeErr)
		}
		
		log.Println("✅ Used direct copy method successfully")
		return nil
	}

	log.Println("✅ Used rename method successfully")
	return nil
}

// createBackupUnsafe creates a backup of the current configuration (ไม่มี mutex lock)
func (rs *RouteService) createBackupUnsafe() error {
	if _, err := os.Stat(rs.configPath); os.IsNotExist(err) {
		log.Println("ℹ️  No existing config file to backup")
		return nil // No file to backup
	}

	backupPath := fmt.Sprintf("%s.backup.%d", rs.configPath, time.Now().Unix())
	
	input, err := ioutil.ReadFile(rs.configPath)
	if err != nil {
		log.Printf("⚠️  Failed to read original file for backup: %v", err)
		return fmt.Errorf("failed to read original file: %w", err)
	}

	err = ioutil.WriteFile(backupPath, input, 0644)
	if err != nil {
		log.Printf("⚠️  Failed to create backup: %v", err)
		return fmt.Errorf("failed to create backup: %w", err)
	}

	log.Printf("💾 Created config backup: %s", backupPath)
	return nil
}

// getNextRouteID finds the next available route ID
func (rs *RouteService) getNextRouteID(routes []RouteConfig) int {
	maxID := 0
	for _, route := range routes {
		if route.ID > maxID {
			maxID = route.ID
		}
	}
	nextID := maxID + 1
	log.Printf("🔢 Next available route ID: %d", nextID)
	return nextID
}

// CreateQuickRoute creates common route configurations quickly
func (rs *RouteService) CreateQuickRoute(routeType, name, uri, target string, port int) error {
	log.Printf("🚀 Creating quick route: %s (%s)", name, routeType)
	
	var route RouteConfig

	switch routeType {
	case "wordpress":
		route = RouteConfig{
			Name:        name,
			Description: fmt.Sprintf("WordPress API route for %s", target),
			URI:         uri,
			Methods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			Upstream: UpstreamConfig{
				Type:  "roundrobin",
				Nodes: map[string]int{fmt.Sprintf("%s:%d", target, port): 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
					"allow_headers": "Origin,Content-Type,Accept,Authorization,X-Requested-With",
					"allow_credentials": false,
					"max_age": 86400,
					"expose_headers": "Content-Length,X-Total-Count",
				},
				"proxy-rewrite": map[string]interface{}{
					"regex_uri": []string{
						fmt.Sprintf("^%s(.*)", uri),
						"/wp-json/wp/v2/posts$1",
					},
				},
			},
		}
		log.Println("🔧 Created WordPress route template with CORS and proxy-rewrite")
		
	case "gofiber":
		route = RouteConfig{
			Name:        name,
			Description: fmt.Sprintf("GoFiber API route for %s", target),
			URI:         uri,
			Methods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			Upstream: UpstreamConfig{
				Type:  "roundrobin",
				Nodes: map[string]int{fmt.Sprintf("%s:%d", target, port): 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
					"allow_headers": "Origin,Content-Type,Accept,Authorization,X-Requested-With,X-API-Key",
					"allow_credentials": false,
					"max_age": 86400,
					"expose_headers": "Content-Length,X-Total-Count",
				},
			},
		}
		log.Println("🔧 Created GoFiber route template with CORS")
		
	default:
		// Generic route
		route = RouteConfig{
			Name:        name,
			Description: fmt.Sprintf("Generic HTTP route for %s", target),
			URI:         uri,
			Methods:     []string{"GET", "OPTIONS"},
			Upstream: UpstreamConfig{
				Type:  "roundrobin",
				Nodes: map[string]int{fmt.Sprintf("%s:%d", target, port): 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,OPTIONS",
					"allow_headers": "Origin,Content-Type,Accept",
					"allow_credentials": false,
					"max_age": 86400,
				},
			},
		}
		log.Println("🔧 Created generic route template with basic CORS")
	}

	return rs.AddRoute(route)
}

// ReloadAPISIX attempts to reload APISIX configuration
func (rs *RouteService) ReloadAPISIX() error {
	log.Println("🔄 APISIX reload requested")
	
	// In a real scenario, you might:
	// 1. Send signal to APISIX process
	// 2. Call Docker API to restart container
	// 3. Use APISIX Admin API if available
	// 4. Execute shell command to reload
	
	log.Println("ℹ️  Configuration file updated successfully")
	log.Println("⚠️  Manual APISIX container restart required for changes to take effect")
	log.Println("💡 Run: docker-compose restart apisix_api")
	
	return nil
}