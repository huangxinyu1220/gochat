package config

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spf13/viper"
)

// Config 全局配置结构
type Config struct {
	Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Redis     RedisConfig     `mapstructure:"redis"`
	JWT       JWTConfig       `mapstructure:"jwt"`
	WebSocket WebSocketConfig `mapstructure:"websocket"`
	CORS      CORSConfig      `mapstructure:"cors"`
	Log       LogConfig       `mapstructure:"log"`
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret      string `mapstructure:"secret"`
	ExpireHours int    `mapstructure:"expire_hours"`
}

// WebSocketConfig WebSocket配置
type WebSocketConfig struct {
	ReadBufferSize  int    `mapstructure:"read_buffer_size"`
	WriteBufferSize int    `mapstructure:"write_buffer_size"`
	MaxMessageSize  int    `mapstructure:"max_message_size"`
	PongWait        string `mapstructure:"pong_wait"`
	WriteWait       string `mapstructure:"write_wait"`
}

// CORSConfig CORS配置
type CORSConfig struct {
	AllowedOrigins     []string `mapstructure:"allowed_origins"`
	AllowCredentials   bool     `mapstructure:"allow_credentials"`
	AllowedMethods     []string `mapstructure:"allowed_methods"`
	AllowedHeaders     []string `mapstructure:"allowed_headers"`
	MaxAge             int      `mapstructure:"max_age"`
}

// LogConfig 日志配置
type LogConfig struct {
	Level  string `mapstructure:"level"`  // 日志级别: debug/info/warn/error
	Dir    string `mapstructure:"dir"`    // 日志文件目录
	Output string `mapstructure:"output"` // 输出目标: console/file/both
}

var AppConfig Config

// Init 初始化配置
func Init(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	// 绑定环境变量
	viper.AutomaticEnv()
	viper.BindEnv("jwt.secret", "JWT_SECRET")
	viper.BindEnv("database.password", "DB_PASSWORD")

	// 设置默认值
	setDefaults()

	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}

	if err := viper.Unmarshal(&AppConfig); err != nil {
		return nil, err
	}

	// 验证必需的配置项
	if err := validateConfig(&AppConfig); err != nil {
		return nil, err
	}

	return &AppConfig, nil
}

// setDefaults 设置默认配置
func setDefaults() {
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.mode", "debug")

	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 3306)
	viper.SetDefault("database.user", "root")
	viper.SetDefault("database.password", "root123")
	viper.SetDefault("database.dbname", "im_db")
	viper.SetDefault("database.max_idle_conns", 10)
	viper.SetDefault("database.max_open_conns", 100)

	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)

	// JWT密钥必须通过环境变量或配置文件设置，不提供不安全的默认值
	// 在生产环境中必须设置 JWT_SECRET 环境变量
	viper.SetDefault("jwt.expire_hours", 168)

	viper.SetDefault("websocket.read_buffer_size", 1024)
	viper.SetDefault("websocket.write_buffer_size", 1024)
	viper.SetDefault("websocket.max_message_size", 10240)
	viper.SetDefault("websocket.pong_wait", "60s")
	viper.SetDefault("websocket.write_wait", "10s")

	// 生产环境应配置具体的允许域名，开发环境默认允许本地域名
	viper.SetDefault("cors.allowed_origins", []string{"http://localhost:3000", "http://127.0.0.1:3000"})
	viper.SetDefault("cors.allow_credentials", true)
	viper.SetDefault("cors.allowed_methods", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	viper.SetDefault("cors.allowed_headers", []string{"Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "accept", "origin", "Cache-Control", "X-Requested-With"})
	viper.SetDefault("cors.max_age", 86400) // 24小时

	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.dir", "./logs")
	viper.SetDefault("log.output", "both") // console/file/both
}

// GetConfigPath 获取配置文件路径
func GetConfigPath() string {
	_, filename, _, _ := runtime.Caller(0)
	dir := filepath.Dir(filename)
	root := filepath.Dir(filepath.Dir(filepath.Dir(dir)))
	return filepath.Join(root, "config.yaml")
}

// validateConfig 验证配置项
func validateConfig(cfg *Config) error {
	// 验证JWT密钥
	if cfg.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required. Please set JWT_SECRET environment variable or configure jwt.secret in config.yaml")
	}

	// 检查是否使用了不安全的示例密钥
	if strings.Contains(cfg.JWT.Secret, "your-secret-key") ||
	   strings.Contains(cfg.JWT.Secret, "change-in-production") ||
	   len(cfg.JWT.Secret) < 32 {
		return fmt.Errorf("JWT secret is not secure. Please use a strong secret key with at least 32 characters")
	}

	// 验证服务器配置
	if cfg.Server.Port <= 0 || cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", cfg.Server.Port)
	}

	// 验证数据库配置
	if cfg.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if cfg.Database.DBName == "" {
		return fmt.Errorf("database name is required")
	}

	// 验证CORS配置
	if len(cfg.CORS.AllowedOrigins) == 0 {
		return fmt.Errorf("at least one allowed origin must be configured for CORS")
	}

	return nil
}
