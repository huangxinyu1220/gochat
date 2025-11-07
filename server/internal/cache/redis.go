package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"

	"gochat/internal/config"
	"gochat/internal/logger"
)

var (
	RedisClient  *redis.Client
	cacheService *CacheService
)

// Init 初始化Redis连接
func Init(cfg *config.RedisConfig) error {
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	// 初始化缓存服务
	cacheService = NewCacheService(RedisClient)
	logger.GetLogger().Info("Redis connection and cache service initialized successfully")

	return nil
}

// GetRedisClient 获取Redis客户端
func GetRedisClient() *redis.Client {
	return RedisClient
}

// GetCacheService 获取增强缓存服务
func GetCacheService() *CacheService {
	return cacheService
}

// SetOnlineStatus 设置用户在线状态
func SetOnlineStatus(userID int64, isOnline bool) error {
	ctx := context.Background()
	key := fmt.Sprintf("online:%d", userID)

	if isOnline {
		// 设置为在线，5分钟过期
		return RedisClient.Set(ctx, key, "1", 5*time.Minute).Err()
	} else {
		// 设置为离线
		return RedisClient.Del(ctx, key).Err()
	}
}

// IsUserOnline 检查用户是否在线
func IsUserOnline(userID int64) (bool, error) {
	ctx := context.Background()
	key := fmt.Sprintf("online:%d", userID)

	exists, err := RedisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}

	return exists > 0, nil
}

// StoreToken 存储JWT Token
func StoreToken(userID int64, token string, expire time.Duration) error {
	ctx := context.Background()
	key := fmt.Sprintf("token:%d", userID)

	return RedisClient.Set(ctx, key, token, expire).Err()
}

// GetToken 获取用户Token
func GetToken(userID int64) (string, error) {
	ctx := context.Background()
	key := fmt.Sprintf("token:%d", userID)

	return RedisClient.Get(ctx, key).Result()
}

// DeleteToken 删除用户Token (登出)
func DeleteToken(userID int64) error {
	ctx := context.Background()
	key := fmt.Sprintf("token:%d", userID)

	return RedisClient.Del(ctx, key).Err()
}

// GetUnreadCount 获取未读消息计数
func GetUnreadCount(userID int64, convID string) (int, error) {
	ctx := context.Background()
	key := fmt.Sprintf("unread:%d", userID)

	result, err := RedisClient.HGet(ctx, key, convID).Result()
	if err == redis.Nil {
		return 0, nil
	} else if err != nil {
		return 0, err
	}

	var count int
	if err := json.Unmarshal([]byte(result), &count); err != nil {
		return 0, err
	}

	return count, nil
}

// SetUnreadCount 设置未读消息计数
func SetUnreadCount(userID int64, convID string, count int) error {
	ctx := context.Background()
	key := fmt.Sprintf("unread:%d", userID)

	data, err := json.Marshal(count)
	if err != nil {
		return err
	}

	return RedisClient.HSet(ctx, key, convID, data).Err()
}

// ClearUnreadCount 清除未读消息计数
func ClearUnreadCount(userID int64, convID string) error {
	ctx := context.Background()
	key := fmt.Sprintf("unread:%d", userID)

	return RedisClient.HDel(ctx, key, convID).Err()
}

// Close 关闭Redis连接
func Close() error {
	return RedisClient.Close()
}
