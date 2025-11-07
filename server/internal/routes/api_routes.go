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

	// 设置中间件
	r.Use(middleware.CORS())
	r.Use(middleware.RequestLogger())
	r.Use(middleware.Recovery())

	// API路由组 v1
	apiV1 := r.Group("/api/v1")

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
	r.GET("/ws", websocket.WebSocketHandler(cfg))
}
