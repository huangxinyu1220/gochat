package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"gochat/internal/cache"
	"gochat/internal/config"
	"gochat/internal/database"
	"gochat/internal/logger"
	"gochat/internal/routes"
	"gochat/internal/tasks"
	"gochat/internal/websocket"
)

func main() {
	// 初始化配置
	cfg, err := config.Init(config.GetConfigPath())
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 初始化日志系统
	if err := logger.Init(cfg.Log.Dir, cfg.Log.Level, cfg.Log.Output); err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	log := logger.GetLogger()

	// 设置Gin运行模式
	gin.SetMode(cfg.Server.Mode)

	// 配置Gin日志输出
	if cfg.Log.Output == "file" || cfg.Log.Output == "both" {
		// 将Gin的日志输出到日志文件
		gin.DefaultWriter = logger.Log.Writer()
		gin.DefaultErrorWriter = logger.Log.Writer()
	}
	// 如果是console模式，Gin默认会输出到stdout

	// 初始化数据库
	if err := database.Init(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	log.Info("Database connected successfully")

	// 执行数据库迁移
	if err := database.Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Info("Database migration completed")

	// 优化数据库性能
	if err := database.OptimizeDatabase(database.GetDB()); err != nil {
		log.Warnf("Database optimization failed: %v", err)
	} else {
		log.Info("Database optimization completed")
	}

	// 初始化Redis
	if err := cache.Init(&cfg.Redis); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Info("Redis connected successfully")

	// 启动WebSocket清理协程
	websocket.Manager.StartCleanup()
	log.Info("WebSocket cleanup routine started")

	// 启动文件清理定时任务
	fileCleanupTask := tasks.NewFileCleanupTask()
	fileCleanupTask.Start()
	log.Info("File cleanup task started")

	// 初始化Gin路由
	r := gin.New()

	// 初始化路由
	routes.SetupAPIRoutes(r, cfg)

	// 设置服务器
	srv := &http.Server{
		Addr:         cfg.Server.Host + ":" + fmt.Sprintf("%d", cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// 启动服务器
	go func() {
		log.Infof("Server starting on %s:%d", cfg.Server.Host, cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s", err)
		}
	}()

	// 等待中断信号以优雅地关闭服务器
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("Shutdown Server ...")

	// 设置5秒超时关闭服务器
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Errorf("Server Shutdown error: %v", err)
	}

	// 关闭数据库和Redis连接
	database.Close()
	cache.Close()

	log.Info("Server exited successfully")
}

