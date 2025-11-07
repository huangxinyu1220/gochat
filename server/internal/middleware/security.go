package middleware

import (
	"html"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"gochat/internal/errors"
	"gochat/internal/logger"
)

// RateLimiter 基于令牌桶算法的速率限制器
type RateLimiter struct {
	tokens     int64     // 当前令牌数量
	capacity   int64     // 桶容量
	rate       int64     // 补充速率（每秒）
	lastTime   time.Time // 上次补充时间
	lastAccess time.Time // 上次访问时间（用于TTL清理）
	mutex      sync.Mutex
}

// NewRateLimiter 创建新的速率限制器
func NewRateLimiter(capacity, rate int64) *RateLimiter {
	now := time.Now()
	return &RateLimiter{
		tokens:     capacity,
		capacity:   capacity,
		rate:       rate,
		lastTime:   now,
		lastAccess: now,
	}
}

// Allow 检查是否允许请求通过
func (rl *RateLimiter) Allow() bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	rl.lastAccess = now // 更新最后访问时间
	elapsed := now.Sub(rl.lastTime).Seconds()

	// 补充令牌
	tokensToAdd := int64(elapsed * float64(rl.rate))
	if tokensToAdd > 0 {
		rl.tokens = min(rl.capacity, rl.tokens+tokensToAdd)
		rl.lastTime = now
	}

	// 检查是否有可用令牌
	if rl.tokens > 0 {
		rl.tokens--
		return true
	}

	return false
}

// IsExpired 检查速率限制器是否已过期（用于TTL清理）
func (rl *RateLimiter) IsExpired(ttl time.Duration) bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()
	return time.Since(rl.lastAccess) > ttl
}

// min returns the smaller of two int64 values
func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// RateLimitConfig 速率限制配置
type RateLimitConfig struct {
	// 通用API限制
	GlobalRPS    int64 // 每秒请求数
	GlobalBurst  int64 // 突发容量

	// 认证相关限制
	AuthRPS      int64 // 认证接口每秒请求数
	AuthBurst    int64 // 认证接口突发容量

	// 消息发送限制
	MessageRPS   int64 // 消息发送每秒请求数
	MessageBurst int64 // 消息发送突发容量

	// 文件上传限制
	UploadRPS    int64 // 文件上传每秒请求数
	UploadBurst  int64 // 文件上传突发容量
}

// DefaultRateLimitConfig 默认速率限制配置
func DefaultRateLimitConfig() *RateLimitConfig {
	return &RateLimitConfig{
		GlobalRPS:    100, // 100 requests per second
		GlobalBurst:  200, // burst of 200 requests

		AuthRPS:      5,   // 5 auth requests per second
		AuthBurst:    10,  // burst of 10 auth requests

		MessageRPS:   10,  // 10 messages per second
		MessageBurst: 20,  // burst of 20 messages

		UploadRPS:    3,   // 3 uploads per second
		UploadBurst:  5,   // burst of 5 uploads
	}
}

// rateLimiters 存储不同用户和端点的速率限制器
var (
	globalLimiters = make(map[string]*RateLimiter)
	limiterMutex   sync.RWMutex
	cleanupStarted bool
)

// 启动清理协程
func init() {
	if !cleanupStarted {
		cleanupStarted = true
		go rateLimiterCleanup()
	}
}

// rateLimiterCleanup 清理过期的速率限制器
func rateLimiterCleanup() {
	ticker := time.NewTicker(10 * time.Minute) // 每10分钟清理一次
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			cleanupExpiredLimiters()
		}
	}
}

// cleanupExpiredLimiters 清理过期的速率限制器
func cleanupExpiredLimiters() {
	limiterMutex.Lock()
	defer limiterMutex.Unlock()

	// TTL为30分钟，超过30分钟未使用的速率限制器将被清理
	ttl := 30 * time.Minute
	var expiredKeys []string

	for key, limiter := range globalLimiters {
		if limiter.IsExpired(ttl) {
			expiredKeys = append(expiredKeys, key)
		}
	}

	// 删除过期的速率限制器
	for _, key := range expiredKeys {
		delete(globalLimiters, key)
	}

	if len(expiredKeys) > 0 {
		logger.GetLogger().Debugf("清理了 %d 个过期的速率限制器", len(expiredKeys))
	}
}

// getRateLimiter 获取或创建速率限制器
func getRateLimiter(key string, rps, burst int64) *RateLimiter {
	limiterMutex.Lock()
	defer limiterMutex.Unlock()

	if limiter, exists := globalLimiters[key]; exists {
		return limiter
	}

	limiter := NewRateLimiter(burst, rps)
	globalLimiters[key] = limiter
	return limiter
}

// RateLimit 速率限制中间件
func RateLimit(config *RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取客户端标识（优先使用认证用户ID，否则使用IP）
		var clientID string
		if userID, exists := c.Get("user_id"); exists {
			clientID = "user:" + strconv.FormatInt(userID.(int64), 10)
		} else {
			clientID = "ip:" + c.ClientIP()
		}

		// 根据请求路径确定限制策略
		var rps, burst int64
		path := c.Request.URL.Path

		switch {
		case strings.Contains(path, "/auth/"):
			rps = config.AuthRPS
			burst = config.AuthBurst
		case strings.Contains(path, "/upload/"):
			rps = config.UploadRPS
			burst = config.UploadBurst
		case strings.Contains(path, "/message/") || c.Request.Method == "POST":
			rps = config.MessageRPS
			burst = config.MessageBurst
		default:
			rps = config.GlobalRPS
			burst = config.GlobalBurst
		}

		// 创建限制器键
		limiterKey := clientID + ":" + path

		// 获取速率限制器
		limiter := getRateLimiter(limiterKey, rps, burst)

		// 检查是否允许请求
		if !limiter.Allow() {
			logger.GetLogger().Warnf("Rate limit exceeded for client %s on path %s", clientID, path)
			errors.HandleBadRequest(c, "Rate limit exceeded. Please slow down.")
			return
		}

		// 添加速率限制头信息
		c.Header("X-RateLimit-Limit", strconv.FormatInt(rps, 10))
		c.Header("X-RateLimit-Remaining", strconv.FormatInt(limiter.tokens, 10))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Second).Unix(), 10))

		c.Next()
	}
}

// SecurityHeaders 安全头中间件
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Content Security Policy - 防止XSS攻击
		c.Header("Content-Security-Policy",
			"default-src 'self'; "+
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; "+
			"style-src 'self' 'unsafe-inline'; "+
			"img-src 'self' data: blob: https:; "+
			"font-src 'self' data:; "+
			"connect-src 'self' ws: wss:; "+
			"media-src 'self'; "+
			"object-src 'none'; "+
			"frame-ancestors 'none'")

		// X-Content-Type-Options - 防止MIME类型嗅探
		c.Header("X-Content-Type-Options", "nosniff")

		// X-Frame-Options - 防止点击劫持
		c.Header("X-Frame-Options", "DENY")

		// X-XSS-Protection - 启用XSS过滤
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer-Policy - 控制referrer信息
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Strict-Transport-Security - 强制HTTPS（仅在HTTPS时启用）
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		// Feature-Policy / Permissions-Policy - 控制浏览器功能
		c.Header("Permissions-Policy",
			"accelerometer=(), "+
			"camera=(), "+
			"geolocation=(), "+
			"gyroscope=(), "+
			"magnetometer=(), "+
			"microphone=(), "+
			"payment=(), "+
			"usb=()")

		// Cache-Control - 安全的缓存策略
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
		}

		c.Next()
	}
}

// InputSanitization 输入清理中间件
func InputSanitization() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 创建新的清理上下文
		sanitizedCtx := &SanitizedContext{Context: c}

		// 替换原有上下文
		c.Set("sanitized", sanitizedCtx)

		c.Next()
	}
}

// SanitizedContext 清理后的上下文包装器
type SanitizedContext struct {
	*gin.Context
}

// SanitizeString 清理字符串输入
func (sc *SanitizedContext) SanitizeString(input string) string {
	// HTML转义防止XSS
	sanitized := html.EscapeString(input)

	// 移除潜在危险字符
	sanitized = strings.ReplaceAll(sanitized, "<script", "&lt;script")
	sanitized = strings.ReplaceAll(sanitized, "</script", "&lt;/script")
	sanitized = strings.ReplaceAll(sanitized, "javascript:", "")
	sanitized = strings.ReplaceAll(sanitized, "vbscript:", "")
	sanitized = strings.ReplaceAll(sanitized, "onload=", "")
	sanitized = strings.ReplaceAll(sanitized, "onerror=", "")

	// 限制长度防止DoS
	maxLength := 10000
	if len(sanitized) > maxLength {
		sanitized = sanitized[:maxLength]
	}

	return sanitized
}

// SanitizeJSON 清理JSON输入
func (sc *SanitizedContext) SanitizeJSON(obj interface{}) error {
	// 首先正常绑定JSON
	if err := sc.ShouldBindJSON(obj); err != nil {
		return err
	}

	// 清理结构体中的字符串字段
	sc.sanitizeStructFields(obj)

	return nil
}

// sanitizeStructFields 清理结构体字段
func (sc *SanitizedContext) sanitizeStructFields(obj interface{}) {
	// 使用反射遍历结构体字段并清理字符串
	// 这里可以根据需要实现更复杂的清理逻辑
	// 为了示例，这里只是一个基础实现
}

// GetSanitizedString 从查询参数或表单获取清理后的字符串
func (sc *SanitizedContext) GetSanitizedString(key string) string {
	value := sc.Query(key)
	if value == "" {
		value = sc.PostForm(key)
	}
	return sc.SanitizeString(value)
}

// ValidatePhoneNumber 验证手机号格式
func ValidatePhoneNumber(phone string) bool {
	// 验证中国手机号格式（11位数字，以1开头）
	if len(phone) != 11 {
		return false
	}

	if phone[0] != '1' {
		return false
	}

	for _, char := range phone {
		if char < '0' || char > '9' {
			return false
		}
	}

	return true
}

// ValidatePassword 验证密码强度
func ValidatePassword(password string) bool {
	// 基本长度检查
	if len(password) < 6 || len(password) > 128 {
		return false
	}

	// 检查是否包含不安全字符
	unsafeChars := []string{"<", ">", "&", "'", "\"", "/", "\\"}
	for _, char := range unsafeChars {
		if strings.Contains(password, char) {
			return false
		}
	}

	return true
}

// ValidateNickname 验证昵称
func ValidateNickname(nickname string) bool {
	// 长度检查
	if len(nickname) < 1 || len(nickname) > 50 {
		return false
	}

	// 检查特殊字符
	forbidden := []string{"<", ">", "&", "'", "\"", "admin", "system", "root"}
	lowercaseNickname := strings.ToLower(nickname)

	for _, word := range forbidden {
		if strings.Contains(lowercaseNickname, word) {
			return false
		}
	}

	return true
}

// CSRF 防护中间件（简化版）
func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 对于非安全方法，检查CSRF token
		if c.Request.Method != "GET" && c.Request.Method != "HEAD" && c.Request.Method != "OPTIONS" {
			// 检查Referer头
			referer := c.GetHeader("Referer")
			origin := c.GetHeader("Origin")
			host := c.GetHeader("Host")

			// 验证请求来源
			if referer == "" && origin == "" {
				// WebSocket升级请求可以跳过
				if c.GetHeader("Upgrade") != "websocket" {
					logger.GetLogger().Warnf("CSRF protection: Missing referer and origin headers from %s", c.ClientIP())
					errors.HandleBadRequest(c, "Invalid request origin")
					return
				}
			}

			// 简单的同源检查
			if origin != "" && !strings.Contains(origin, host) &&
			   !strings.Contains(origin, "localhost") &&
			   !strings.Contains(origin, "127.0.0.1") {
				logger.GetLogger().Warnf("CSRF protection: Invalid origin %s for host %s from %s", origin, host, c.ClientIP())
				errors.HandleBadRequest(c, "Invalid request origin")
				return
			}
		}

		c.Next()
	}
}

// IPWhitelist IP白名单中间件（可选）
func IPWhitelist(allowedIPs []string) gin.HandlerFunc {
	ipSet := make(map[string]bool)
	for _, ip := range allowedIPs {
		ipSet[ip] = true
	}

	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		// 如果白名单为空，则允许所有IP
		if len(ipSet) == 0 {
			c.Next()
			return
		}

		if !ipSet[clientIP] {
			logger.GetLogger().Warnf("IP %s not in whitelist", clientIP)
			errors.HandleBadRequest(c, "Access denied")
			return
		}

		c.Next()
	}
}

// RequestSizeLimit 请求大小限制中间件
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置最大请求体大小
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)
		c.Next()
	}
}

// UserAgentFilter 用户代理过滤中间件
func UserAgentFilter() gin.HandlerFunc {
	// 恶意或可疑的用户代理模式
	suspiciousPatterns := []string{
		"sqlmap",
		"nmap",
		"nikto",
		"masscan",
		"zmap",
		"gobuster",
		"dirb",
		"dirbuster",
		"burpsuite",
		"python-requests", // 可以根据需要调整
	}

	return func(c *gin.Context) {
		userAgent := strings.ToLower(c.GetHeader("User-Agent"))

		// 检查是否包含可疑模式
		for _, pattern := range suspiciousPatterns {
			if strings.Contains(userAgent, pattern) {
				logger.GetLogger().Warnf("Suspicious user agent detected: %s from %s",
					c.GetHeader("User-Agent"), c.ClientIP())
				errors.HandleBadRequest(c, "Request blocked")
				return
			}
		}

		c.Next()
	}
}

// CleanupLimiters 定期清理无用的限制器
func CleanupLimiters() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			limiterMutex.Lock()
			// 简单的清理策略：清理所有限制器让它们重新创建
			// 在生产环境中可能需要更智能的清理策略
			if len(globalLimiters) > 10000 { // 防止内存泄漏
				globalLimiters = make(map[string]*RateLimiter)
				logger.GetLogger().Info("Rate limiter cache cleared")
			}
			limiterMutex.Unlock()
		}
	}()
}

// init 初始化函数
func init() {
	// 启动限制器清理协程
	CleanupLimiters()
}