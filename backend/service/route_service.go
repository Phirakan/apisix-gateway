// backend/service/route_service.go (แก้ไข Path และ Error Handling)
package services

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"  // เพิ่ม import ที่ขาดหายไป
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
	mutex      sync.RWMutex
}

// NewRouteService creates a new RouteService instance with corrected paths
func NewRouteService(configPath string) *RouteService {
	// Priority order for config path:
	// 1. Explicitly provided path
	// 2. Environment variable
	// 3. Shared volume path (for Docker)
	// 4. Host bind mount path
	// 5. Default fallback
	
	if configPath == "" {
		if envPath := os.Getenv("ROUTE_CONFIG_PATH"); envPath != "" {
			configPath = envPath
			log.Printf("📁 Using config path from environment: %s", configPath)
		} else {
			// Try shared volume path first (recommended for Docker)
			possiblePaths := []string{
				"/shared/apisix.yaml",        // Shared volume between APISIX and GoFiber
				"/app/apisix.yaml",           // Direct bind mount
				"./apisix/apisix.yaml",       // Local development
				"/usr/local/apisix/conf/apisix.yaml", // Inside APISIX container (if co-located)
			}
			
			for _, path := range possiblePaths {
				if _, err := os.Stat(path); err == nil {
					configPath = path
					log.Printf("📁 Found existing config at: %s", configPath)
					break
				}
			}
			
			// If no existing file found, use shared volume path as default
			if configPath == "" {
				configPath = "/shared/apisix.yaml"
				log.Printf("📁 Using default shared volume path: %s", configPath)
			}
		}
	}
	
	log.Printf("🚀 Route service initialized with config path: %s", configPath)
	
	// Verify directory exists and is writable
	if err := ensureDirectoryExists(configPath); err != nil {
		log.Printf("⚠️  Warning: Could not ensure directory exists: %v", err)
	}
	
	return &RouteService{
		configPath: configPath,
	}
}

// ensureDirectoryExists ensures the directory for config file exists
func ensureDirectoryExists(configPath string) error {
	dir := filepath.Dir(configPath)
	
	// Check if directory exists
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		log.Printf("📁 Creating directory: %s", dir)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}
	
	// Test write permissions
	testFile := filepath.Join(dir, ".write_test")
	if err := ioutil.WriteFile(testFile, []byte("test"), 0644); err != nil {
		log.Printf("⚠️  Directory %s may not be writable: %v", dir, err)
		return err
	}
	os.Remove(testFile) // Clean up test file
	
	log.Printf("✅ Directory %s is accessible and writable", dir)
	return nil
}

// GetRoutes reads and returns all routes from APISIX config
func (rs *RouteService) GetRoutes() ([]RouteConfig, error) {
	rs.mutex.RLock()
	defer rs.mutex.RUnlock()
	
	log.Printf("📖 Reading routes from: %s", rs.configPath)
	
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
	
	log.Printf("📖 Reading upstreams from: %s", rs.configPath)
	
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

// readConfigUnsafe reads the APISIX configuration file (no mutex lock)
func (rs *RouteService) readConfigUnsafe() (*APISIXConfig, error) {
	log.Printf("📖 Reading config from: %s", rs.configPath)
	
	// Check if file exists
	if _, err := os.Stat(rs.configPath); os.IsNotExist(err) {
		log.Printf("⚠️  Config file doesn't exist, creating default: %s", rs.configPath)
		
		// Create default config with existing routes from apisix.yaml if available
		defaultConfig := rs.createDefaultConfig()
		
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

	// Handle empty file
	if len(data) == 0 {
		log.Printf("⚠️  Config file is empty, creating default content")
		defaultConfig := rs.createDefaultConfig()
		err := rs.writeConfigUnsafe(defaultConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to write default config: %w", err)
		}
		return defaultConfig, nil
	}

	var config APISIXConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		log.Printf("❌ Failed to parse YAML: %v", err)
		log.Printf("📄 File content: %s", string(data))
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// Initialize empty slices if nil
	if config.Routes == nil {
		config.Routes = []RouteConfig{}
	}
	if config.Upstreams == nil {
		config.Upstreams = []UpstreamDefinition{}
	}

	log.Printf("✅ Successfully parsed config: %d routes, %d upstreams", 
		len(config.Routes), len(config.Upstreams))
	return &config, nil
}

// createDefaultConfig creates a default configuration with some basic routes
func (rs *RouteService) createDefaultConfig() *APISIXConfig {
	log.Println("🎯 Creating default APISIX configuration...")
	
	defaultRoutes := []RouteConfig{
		{
			ID:          1,
			Name:        "WordPress Posts API",
			Description: "WordPress REST API for posts",
			URI:         "/api/posts",
			Methods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			Upstream: UpstreamConfig{
				Type:    "roundrobin",
				Nodes:   map[string]int{"wordpress:80": 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_credentials": false,
					"allow_headers":     "Origin,Content-Type,Accept,Authorization,X-Requested-With",
					"allow_methods":     "GET,POST,PUT,DELETE,OPTIONS",
					"allow_origins":     "*",
					"expose_headers":    "Content-Length,X-Total-Count",
					"max_age":          86400,
				},
				"proxy-rewrite": map[string]interface{}{
					"regex_uri": []string{"^/api/posts(.*)", "/wp-json/wp/v2/posts$1"},
				},
			},
		},
		{
			ID:          2,
			Name:        "GoFiber Health Check",
			Description: "Health check endpoint for GoFiber backend",
			URI:         "/api/health",
			Methods:     []string{"GET", "OPTIONS"},
			Upstream: UpstreamConfig{
				Type:    "roundrobin",
				Nodes:   map[string]int{"gofiber-backend:3000": 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_credentials": false,
					"allow_headers":     "Origin,Content-Type,Accept,Authorization,X-Requested-With",
					"allow_methods":     "GET,OPTIONS",
					"allow_origins":     "*",
					"expose_headers":    "Content-Length,X-Total-Count",
					"max_age":          86400,
				},
			},
		},
		{
			ID:          3,
			Name:        "GoFiber Data API",
			Description: "GoFiber backend data operations",
			URI:         "/api/data/*",
			Methods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			Upstream: UpstreamConfig{
				Type:    "roundrobin",
				Nodes:   map[string]int{"gofiber-backend:3000": 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_credentials": false,
					"allow_headers":     "Origin,Content-Type,Accept,Authorization,X-Requested-With,X-API-Key",
					"allow_methods":     "GET,POST,PUT,DELETE,OPTIONS",
					"allow_origins":     "*",
					"expose_headers":    "Content-Length,X-Total-Count",
					"max_age":          86400,
				},
			},
		},
	}

	defaultUpstreams := []UpstreamDefinition{
		{
			ID:          1,
			Name:        "WordPress Upstream",
			Description: "Upstream for WordPress container",
			Type:        "roundrobin",
			Nodes:       map[string]int{"wordpress:80": 1},
			Timeout:     &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
		},
		{
			ID:          2,
			Name:        "GoFiber Upstream",
			Description: "Upstream for GoFiber backend container",
			Type:        "roundrobin",
			Nodes:       map[string]int{"gofiber-backend:3000": 1},
			Timeout:     &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
		},
	}

	return &APISIXConfig{
		Routes:    defaultRoutes,
		Upstreams: defaultUpstreams,
	}
}

// writeConfigUnsafe writes the configuration back to the file (no mutex lock)
func (rs *RouteService) writeConfigUnsafe(config *APISIXConfig) error {
	log.Printf("💾 Writing config to: %s", rs.configPath)
	
	// Create backup before writing
	rs.createBackupUnsafe()
	
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	// Enhanced file writing for Docker volumes
	err = rs.writeFileSafely(rs.configPath, data)
	if err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	log.Printf("✅ Successfully wrote config to: %s", rs.configPath)
	
	// Verify written data
	if err := rs.verifyWrittenConfig(config); err != nil {
		log.Printf("⚠️  Config verification warning: %v", err)
	}
	
	return nil
}

// writeFileSafely writes file safely for Docker mounted volumes
func (rs *RouteService) writeFileSafely(filepath string, data []byte) error {
	// Method 1: Try atomic write with temp file
	tempFile := filepath + ".tmp." + fmt.Sprintf("%d", time.Now().UnixNano())
	
	err := ioutil.WriteFile(tempFile, data, 0644)
	if err != nil {
		log.Printf("⚠️  Temp file write failed, trying direct write: %v", err)
		// Method 2: Direct write
		return ioutil.WriteFile(filepath, data, 0644)
	}

	// Try to rename (atomic operation)
	err = os.Rename(tempFile, filepath)
	if err != nil {
		log.Printf("⚠️  Rename failed, using copy method: %v", err)
		
		// Method 3: Copy content and remove temp
		tempData, readErr := ioutil.ReadFile(tempFile)
		if readErr != nil {
			os.Remove(tempFile)
			return fmt.Errorf("failed to read temp file: %w", readErr)
		}
		
		writeErr := ioutil.WriteFile(filepath, tempData, 0644)
		os.Remove(tempFile) // Always clean up temp file
		
		if writeErr != nil {
			return fmt.Errorf("failed to write to target file: %w", writeErr)
		}
		
		log.Println("✅ Used copy method successfully")
		return nil
	}

	log.Println("✅ Used atomic rename method successfully")
	return nil
}

// verifyWrittenConfig verifies that the written config is valid
func (rs *RouteService) verifyWrittenConfig(originalConfig *APISIXConfig) error {
	data, err := ioutil.ReadFile(rs.configPath)
	if err != nil {
		return fmt.Errorf("failed to read written config for verification: %w", err)
	}

	var verifyConfig APISIXConfig
	err = yaml.Unmarshal(data, &verifyConfig)
	if err != nil {
		return fmt.Errorf("written config is not valid YAML: %w", err)
	}

	// Basic validation
	if len(verifyConfig.Routes) != len(originalConfig.Routes) {
		return fmt.Errorf("route count mismatch: expected %d, got %d", 
			len(originalConfig.Routes), len(verifyConfig.Routes))
	}

	if len(verifyConfig.Upstreams) != len(originalConfig.Upstreams) {
		return fmt.Errorf("upstream count mismatch: expected %d, got %d", 
			len(originalConfig.Upstreams), len(verifyConfig.Upstreams))
	}

	log.Println("✅ Config verification passed")
	return nil
}

// createBackupUnsafe creates a backup of the current configuration (no mutex lock)
func (rs *RouteService) createBackupUnsafe() error {
	if _, err := os.Stat(rs.configPath); os.IsNotExist(err) {
		log.Println("ℹ️  No existing config file to backup")
		return nil
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
	
	// Verify config file exists and is valid
	if _, err := os.Stat(rs.configPath); os.IsNotExist(err) {
		return fmt.Errorf("config file not found: %s", rs.configPath)
	}
	
	// Test config validity
	_, err := rs.readConfigUnsafe()
	if err != nil {
		return fmt.Errorf("config file is invalid: %w", err)
	}
	
	log.Println("✅ Configuration file is valid")
	log.Println("ℹ️  Configuration updated successfully at: " + rs.configPath)
	log.Println("⚠️  APISIX container restart required for changes to take effect")
	log.Println("💡 Run: docker-compose restart apisix_api")
	
	return nil
}

// GetConfigPath returns the current config path
func (rs *RouteService) GetConfigPath() string {
	return rs.configPath
}

// ValidateConfig validates the current configuration
func (rs *RouteService) ValidateConfig() error {
	rs.mutex.RLock()
	defer rs.mutex.RUnlock()
	
	_, err := rs.readConfigUnsafe()
	return err
}