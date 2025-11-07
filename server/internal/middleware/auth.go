package middleware

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"gochat/internal/cache"
	"gochat/internal/config"
	"gochat/internal/utils"
)

// JWTAuth JWT认证中间件
func JWTAuth(cfg *config.JWTConfig, skipPaths []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过不需要认证的路径
		for _, path := range skipPaths {
			if c.Request.URL.Path == path {
				c.Next()
				return
			}
		}

		// 从请求头获取token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, utils.ErrorResponse(401, "Authorization header required"))
			return
		}

		// 解析Bearer token
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, utils.ErrorResponse(401, "Invalid authorization header format"))
			return
		}

		tokenString := tokenParts[1]

		// 验证token
		userID, err := utils.ValidateToken(tokenString, cfg)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, utils.ErrorResponse(401, "Invalid or expired token"))
			return
		}

		// 验证token在Redis中是否存在（可选，用于强制登出）
		storedToken, err := cache.GetToken(userID)
		if err != nil || storedToken != tokenString {
			c.AbortWithStatusJSON(http.StatusUnauthorized, utils.ErrorResponse(401, "Token not found or expired"))
			return
		}

		// 设置用户信息到上下文中
		c.Set("user_id", userID)
		c.Set("token", tokenString)

		c.Next()
	}
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// RequestLogger 请求日志中间件
func RequestLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("[%s] %s %s %d %s %s\n",
			param.TimeStamp.Format("2006/01/02 15:04:05"),
			param.Method,
			param.Path,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
		)
	})
}

// Recovery 错误恢复中间件
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		if err, ok := recovered.(string); ok {
			log.Printf("panic recovered: %s", err)
		} else {
			log.Printf("panic recovered: %v", recovered)
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Internal server error"))
	})
}
