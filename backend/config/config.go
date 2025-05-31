package config

import (
	"os"
	"strconv"
)

// Config เก็บการตั้งค่าของแอปพลิเคชัน
type Config struct {
	// Server configuration
	Server ServerConfig `json:"server"`
	
	// Database configuration
	Database DatabaseConfig `json:"database"`
	
	// Security configuration
	Security SecurityConfig `json:"security"`
	
	// Features configuration
	Features FeaturesConfig `json:"features"`
}

// ServerConfig การตั้งค่า server
type ServerConfig struct {
	Port         string `json:"port"`
	Host         string `json:"host"`
	Environment  string `json:"environment"` // development, production, testing
	Debug        bool   `json:"debug"`
	Prefork      bool   `json:"prefork"`
	ReadTimeout  int    `json:"read_timeout"`  // seconds
	WriteTimeout int    `json:"write_timeout"` // seconds
}

// DatabaseConfig การตั้งค่า database
type DatabaseConfig struct {
	Host            string `json:"host"`
	Port            string `json:"port"`
	User            string `json:"user"`
	Password        string `json:"password"`
	DBName          string `json:"db_name"`
	MaxIdleConns    int    `json:"max_idle_conns"`
	MaxOpenConns    int    `json:"max_open_conns"`
	ConnMaxLifetime int    `json:"conn_max_lifetime"` // hours
}

// SecurityConfig การตั้งค่าความปลอดภัย
type SecurityConfig struct {
	APIKeys           []string `json:"api_keys"`
	EnableAPIKeyAuth  bool     `json:"enable_api_key_auth"`
	RateLimitEnabled  bool     `json:"rate_limit_enabled"`
	RateLimitMax      int      `json:"rate_limit_max"`     // requests per minute
	MaxRequestSize    int64    `json:"max_request_size"`   // bytes
	EnableHTTPS       bool     `json:"enable_https"`
	CertFile          string   `json:"cert_file"`
	KeyFile           string   `json:"key_file"`
}

// FeaturesConfig การตั้งค่า features
type FeaturesConfig struct {
	EnableSampleData bool `json:"enable_sample_data"`
	EnableSwagger    bool `json:"enable_swagger"`
	EnableMetrics    bool `json:"enable_metrics"`
	EnableHealthz    bool `json:"enable_healthz"`
}

// Load โหลดการตั้งค่าจาก environment variables
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "3000"),
			Host:         getEnv("HOST", "0.0.0.0"),
			Environment:  getEnv("ENVIRONMENT", "development"),
			Debug:        getEnvBool("DEBUG", true),
			Prefork:      getEnvBool("PREFORK", false),
			ReadTimeout:  getEnvInt("READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("WRITE_TIMEOUT", 30),
		},
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "mariadb"),
			Port:            getEnv("DB_PORT", "3306"),
			User:            getEnv("DB_USER", "apisix_user"),
			Password:        getEnv("DB_PASSWORD", "apisix_pass"),
			DBName:          getEnv("DB_NAME", "apisix_db"),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 10),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 100),
			ConnMaxLifetime: getEnvInt("DB_CONN_MAX_LIFETIME", 1),
		},
		Security: SecurityConfig{
			APIKeys:           getEnvSlice("API_KEYS", []string{}),
			EnableAPIKeyAuth:  getEnvBool("ENABLE_API_KEY_AUTH", false),
			RateLimitEnabled:  getEnvBool("RATE_LIMIT_ENABLED", true),
			RateLimitMax:      getEnvInt("RATE_LIMIT_MAX", 100),
			MaxRequestSize:    getEnvInt64("MAX_REQUEST_SIZE", 10*1024*1024), // 10MB
			EnableHTTPS:       getEnvBool("ENABLE_HTTPS", false),
			CertFile:          getEnv("CERT_FILE", ""),
			KeyFile:           getEnv("KEY_FILE", ""),
		},
		Features: FeaturesConfig{
			EnableSampleData: getEnvBool("ENABLE_SAMPLE_DATA", true),
			EnableSwagger:    getEnvBool("ENABLE_SWAGGER", true),
			EnableMetrics:    getEnvBool("ENABLE_METRICS", true),
			EnableHealthz:    getEnvBool("ENABLE_HEALTHZ", true),
		},
	}
}

// IsDevelopment ตรวจสอบว่าอยู่ใน development mode หรือไม่
func (c *Config) IsDevelopment() bool {
	return c.Server.Environment == "development"
}

// IsProduction ตรวจสอบว่าอยู่ใน production mode หรือไม่
func (c *Config) IsProduction() bool {
	return c.Server.Environment == "production"
}

// GetDSN สร้าง database DSN string
func (c *Config) GetDSN() string {
	return c.Database.User + ":" + c.Database.Password + 
		   "@tcp(" + c.Database.Host + ":" + c.Database.Port + ")/" + 
		   c.Database.DBName + "?charset=utf8mb4&parseTime=True&loc=Local"
}

// GetServerAddress สร้าง server address string
func (c *Config) GetServerAddress() string {
	return c.Server.Host + ":" + c.Server.Port
}

// Validate ตรวจสอบความถูกต้องของ config
func (c *Config) Validate() []string {
	var errors []string

	// ตรวจสอบ required fields
	if c.Database.Host == "" {
		errors = append(errors, "Database host is required")
	}
	
	if c.Database.User == "" {
		errors = append(errors, "Database user is required")
	}
	
	if c.Database.DBName == "" {
		errors = append(errors, "Database name is required")
	}

	// ตรวจสอบ HTTPS config
	if c.Security.EnableHTTPS {
		if c.Security.CertFile == "" {
			errors = append(errors, "Certificate file is required when HTTPS is enabled")
		}
		if c.Security.KeyFile == "" {
			errors = append(errors, "Key file is required when HTTPS is enabled")
		}
	}

	// ตรวจสอบ rate limit
	if c.Security.RateLimitEnabled && c.Security.RateLimitMax <= 0 {
		errors = append(errors, "Rate limit max must be greater than 0")
	}

	return errors
}

// Helper functions สำหรับอ่าน environment variables

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseInt(value, 10, 64); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		// สำหรับ API keys แยกด้วย comma
		// ตัวอย่าง: API_KEYS=key1,key2,key3
		return []string{value} // simplified version
	}
	return defaultValue
}