// backend/services/route_service.go
package services

import (
	"fmt"
	"io/ioutil"
	"os"
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
}

// NewRouteService creates a new RouteService instance
func NewRouteService(configPath string) *RouteService {
	if configPath == "" {
		configPath = "/usr/local/apisix/conf/apisix.yaml" // Default APISIX config path
	}
	return &RouteService{
		configPath: configPath,
	}
}

// GetRoutes reads and returns all routes from APISIX config
func (rs *RouteService) GetRoutes() ([]RouteConfig, error) {
	config, err := rs.readConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	return config.Routes, nil
}

// GetUpstreams reads and returns all upstreams from APISIX config
func (rs *RouteService) GetUpstreams() ([]UpstreamDefinition, error) {
	config, err := rs.readConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	return config.Upstreams, nil
}

// AddRoute adds a new route to the configuration
func (rs *RouteService) AddRoute(route RouteConfig) error {
	config, err := rs.readConfig()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	// Auto-generate ID if not provided
	if route.ID == 0 {
		route.ID = rs.getNextRouteID(config.Routes)
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
	}
	if route.Upstream.Type == "" {
		route.Upstream.Type = "roundrobin"
	}

	// Add the new route
	config.Routes = append(config.Routes, route)

	return rs.writeConfig(config)
}

// UpdateRoute updates an existing route
func (rs *RouteService) UpdateRoute(id int, updatedRoute RouteConfig) error {
	config, err := rs.readConfig()
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
			break
		}
	}

	if !found {
		return fmt.Errorf("route with ID %d not found", id)
	}

	return rs.writeConfig(config)
}

// DeleteRoute removes a route from the configuration
func (rs *RouteService) DeleteRoute(id int) error {
	config, err := rs.readConfig()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	// Find and remove the route
	newRoutes := make([]RouteConfig, 0, len(config.Routes))
	found := false
	for _, route := range config.Routes {
		if route.ID != id {
			newRoutes = append(newRoutes, route)
		} else {
			found = true
		}
	}

	if !found {
		return fmt.Errorf("route with ID %d not found", id)
	}

	config.Routes = newRoutes
	return rs.writeConfig(config)
}

// GetRoute returns a specific route by ID
func (rs *RouteService) GetRoute(id int) (*RouteConfig, error) {
	config, err := rs.readConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	for _, route := range config.Routes {
		if route.ID == id {
			return &route, nil
		}
	}

	return nil, fmt.Errorf("route with ID %d not found", id)
}

// readConfig reads the APISIX configuration file
func (rs *RouteService) readConfig() (*APISIXConfig, error) {
	// Create backup before reading
	rs.createBackup()

	data, err := ioutil.ReadFile(rs.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config APISIXConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	return &config, nil
}

// writeConfig writes the configuration back to the file
func (rs *RouteService) writeConfig(config *APISIXConfig) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	// Write to temporary file first
	tempFile := rs.configPath + ".tmp"
	err = ioutil.WriteFile(tempFile, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	// Atomic move
	err = os.Rename(tempFile, rs.configPath)
	if err != nil {
		// Clean up temp file
		os.Remove(tempFile)
		return fmt.Errorf("failed to replace config file: %w", err)
	}

	return nil
}

// createBackup creates a backup of the current configuration
func (rs *RouteService) createBackup() error {
	if _, err := os.Stat(rs.configPath); os.IsNotExist(err) {
		return nil // No file to backup
	}

	backupPath := fmt.Sprintf("%s.backup.%d", rs.configPath, time.Now().Unix())
	
	input, err := ioutil.ReadFile(rs.configPath)
	if err != nil {
		return fmt.Errorf("failed to read original file: %w", err)
	}

	err = ioutil.WriteFile(backupPath, input, 0644)
	if err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

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
	return maxID + 1
}

// CreateQuickRoute creates common route configurations quickly
func (rs *RouteService) CreateQuickRoute(routeType, name, uri, target string, port int) error {
	var route RouteConfig

	switch routeType {
	case "wordpress":
		route = RouteConfig{
			Name:        name,
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
				},
				"proxy-rewrite": map[string]interface{}{
					"regex_uri": []string{
						fmt.Sprintf("^%s(.*)", uri),
						"/wp-json/wp/v2$1",
					},
				},
			},
		}
	case "gofiber":
		route = RouteConfig{
			Name:        name,
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
				},
			},
		}
	default:
		// Generic route
		route = RouteConfig{
			Name:        name,
			URI:         uri,
			Methods:     []string{"GET"},
			Upstream: UpstreamConfig{
				Type:  "roundrobin",
				Nodes: map[string]int{fmt.Sprintf("%s:%d", target, port): 1},
				Timeout: &TimeoutConfig{Connect: 6, Send: 6, Read: 6},
			},
			Plugins: map[string]interface{}{
				"cors": map[string]interface{}{
					"allow_origins": "*",
					"allow_methods": "GET,OPTIONS",
				},
			},
		}
	}

	return rs.AddRoute(route)
}

// ReloadAPISIX attempts to reload APISIX configuration (docker restart simulation)
func (rs *RouteService) ReloadAPISIX() error {
	// In a real scenario, you might trigger a Docker container restart here
	// For now, we'll just return success as the file has been updated
	
	// You could implement:
	// - Docker API call to restart APISIX container
	// - Signal to APISIX process to reload config
	// - HTTP call to management endpoint
	
	return nil
}