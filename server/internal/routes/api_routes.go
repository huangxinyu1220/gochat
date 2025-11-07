package routes

import (
	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/handlers"
	"gochat/internal/middleware"
	"gochat/internal/websocket"
)

func SetupAPIRoutes(r *gin.Engine, cfg *config.Config) {
	// 静态文件服务
	r.Static("/uploads", "./uploads")

	// 创建处理器
	authHandler := handlers.NewAuthHandler(cfg)
	userHandler := handlers.NewUserHandler(cfg)
	friendHandler := handlers.NewFriendHandler(cfg)
	conversationHandler := handlers.NewConversationHandler(cfg)
	messageHandler := handlers.NewMessageHandler(cfg)
	onlineHandler := handlers.NewOnlineHandler(cfg)
	uploadHandler := handlers.NewUploadHandler(cfg)
	groupHandler := handlers.NewGroupHandler(cfg)

	// 设置全局安全中间件（按顺序应用）
	r.Use(middleware.SecurityHeaders())        // 安全头
	r.Use(middleware.RequestSizeLimit(10 << 20)) // 10MB请求大小限制
	r.Use(middleware.UserAgentFilter())        // 用户代理过滤
	r.Use(middleware.CORS(&cfg.CORS))          // 跨域（使用配置）
	r.Use(middleware.RequestLogger())          // 日志
	r.Use(middleware.Recovery())               // 错误恢复

	// 配置速率限制
	rateLimitConfig := &middleware.RateLimitConfig{
		GlobalRPS:    100, // 100 requests per second per user/IP
		GlobalBurst:  200, // burst of 200 requests
		AuthRPS:      5,   // 5 auth requests per second (stricter for auth)
		AuthBurst:    10,  // burst of 10 auth requests
		MessageRPS:   10,  // 10 messages per second
		MessageBurst: 20,  // burst of 20 messages
		UploadRPS:    3,   // 3 uploads per second
		UploadBurst:  5,   // burst of 5 uploads
	}

	// 应用速率限制
	r.Use(middleware.RateLimit(rateLimitConfig))

	// 健康检查端点（不需要任何认证或限制）
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"message": "GoChat API is running",
		})
	})

	// API路由组 v1
	apiV1 := r.Group("/api/v1")

	// 添加输入清理和CSRF保护到API组
	apiV1.Use(middleware.InputSanitization())
	apiV1.Use(middleware.CSRFProtection())

	// 不需要认证的路由
	auth := apiV1.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	// 需要认证的路由
	// 不需要跳过认证的路径列表
	skipPaths := []string{
		"/api/v1/auth/register",
		"/api/v1/auth/login",
		"/api/v1/health",
	}

	// 使用JWT认证中间件
	apiV1.Use(middleware.JWTAuth(&cfg.JWT, skipPaths))

	// 认证相关的路由 - 需要认证
	auth.POST("/logout", authHandler.Logout)

	// 用户相关的路由
	user := apiV1.Group("/user")
	{
		user.GET("/profile", userHandler.GetProfile)
		user.PUT("/profile", userHandler.UpdateProfile)
		user.POST("/upload-avatar", userHandler.UploadAvatar)
		// 搜索用户功能
		user.GET("/search", friendHandler.SearchUsers)
	}

	// 好友相关的路由
	friend := apiV1.Group("/friend")
	{
		friend.GET("/list", friendHandler.GetFriends)
		friend.POST("/add", friendHandler.AddFriend)
		friend.DELETE("/:id", friendHandler.RemoveFriend)
	}

	// 会话相关的路由
	conversation := apiV1.Group("/conversation")
	{
		conversation.GET("/list", conversationHandler.GetConversations)
		conversation.POST("/:id/clear-unread", conversationHandler.ClearUnreadCount)
	}

	// 消息相关的路由
	message := apiV1.Group("/message")
	{
		message.GET("/history", messageHandler.GetMessages)
	}

	// 在线状态相关的路由
	online := apiV1.Group("/online")
	{
		online.GET("/status", onlineHandler.GetOnlineStatus)
		online.GET("/users", onlineHandler.GetOnlineUsers)
		online.GET("/count", onlineHandler.GetOnlineCount)
	}

	// 上传相关的路由
	upload := apiV1.Group("/upload")
	{
		upload.POST("/image", uploadHandler.UploadImage)
	}

	// 群组相关的路由
	group := apiV1.Group("/group")
	{
		group.POST("/create", groupHandler.CreateGroup)
		group.GET("/:id", groupHandler.GetGroup)
		group.GET("/:id/members", groupHandler.GetGroupMembers)
		group.POST("/:id/members", groupHandler.AddGroupMembers)
	}

	// WebSocket路由 (从配置中获取JWT密钥)
	// WebSocket使用单独的安全配置
	r.GET("/ws", websocket.WebSocketHandler(cfg))
}
