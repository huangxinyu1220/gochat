package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"gochat/internal/cache"
	"gochat/internal/logger"
	"gochat/internal/middleware"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 开发阶段允许所有源
	},
}

type ClientInfo struct {
	ID       string          `json:"id"`
	UserID   int64           `json:"user_id"`
	Username string          `json:"username"`
	Conn     *websocket.Conn `json:"-"`
	LastPing time.Time       `json:"last_ping"`
	ConnectedAt time.Time    `json:"connected_at"`
	WriteMutex sync.Mutex    `json:"-"` // 保证WebSocket写操作的线程安全
	Closed   bool            `json:"-"` // 标记连接是否已关闭
}

type ConnectionManager struct {
	clients      sync.Map         // user_id -> *ClientInfo
	rateLimiters sync.Map         // user_id -> *middleware.RateLimiter
	mutex        sync.RWMutex
}

var Manager = &ConnectionManager{}

// GetOrCreateRateLimiter 获取或创建用户的速率限制器
func (cm *ConnectionManager) GetOrCreateRateLimiter(userID int64) *middleware.RateLimiter {
	// WebSocket消息限制: 每秒10条消息，突发20条
	limiter, _ := cm.rateLimiters.LoadOrStore(userID, middleware.NewRateLimiter(20, 10))
	return limiter.(*middleware.RateLimiter)
}

// CheckRateLimit 检查用户是否可以发送消息
func (cm *ConnectionManager) CheckRateLimit(userID int64) bool {
	limiter := cm.GetOrCreateRateLimiter(userID)
	return limiter.Allow()
}

func (cm *ConnectionManager) AddClient(client *ClientInfo) {
	client.ConnectedAt = time.Now()
	client.LastPing = time.Now() // 初始化心跳时间
	client.Closed = false       // 初始化为未关闭状态

	// 检查是否已经有该用户的连接，如果有则先关闭旧连接
	if existingClient, exists := cm.GetClient(client.UserID); exists {
		logger.GetLogger().Debugf("用户 %d 有旧连接，先关闭旧连接", client.UserID)
		// 标记旧连接为已关闭
		existingClient.WriteMutex.Lock()
		existingClient.Closed = true
		existingClient.WriteMutex.Unlock()
		existingClient.Conn.Close()
		cm.RemoveClient(client.UserID)
	}

	cm.clients.Store(client.UserID, client)

	// 设置Redis在线状态
	ctx := context.Background()
	cache.GetRedisClient().Set(ctx, fmt.Sprintf("online:%d", client.UserID), "1", 5*time.Minute)

	logger.GetLogger().Infof("用户 %d (%s) 已上线，当前在线用户数: %d", client.UserID, client.Username, cm.GetOnlineCount())
}

func (cm *ConnectionManager) RemoveClient(userID int64) {
	if client, exists := cm.clients.LoadAndDelete(userID); exists {
		clientInfo := client.(*ClientInfo)

		// 标记连接为已关闭
		clientInfo.WriteMutex.Lock()
		clientInfo.Closed = true
		clientInfo.WriteMutex.Unlock()

		// 清理速率限制器（可选，减少内存占用）
		cm.rateLimiters.Delete(userID)

		// 清除Redis在线状态
		ctx := context.Background()
		cache.GetRedisClient().Del(ctx, fmt.Sprintf("online:%d", userID))

		// 记录在线时长
		duration := time.Since(clientInfo.ConnectedAt)
		logger.GetLogger().Infof("用户 %d 已下线，在线时长: %v，当前在线用户数: %d",
			userID, duration, cm.GetOnlineCount())
	}
}

func (cm *ConnectionManager) GetClient(userID int64) (*ClientInfo, bool) {
	client, exists := cm.clients.Load(userID)
	if !exists {
		return nil, false
	}
	return client.(*ClientInfo), true
}

func (cm *ConnectionManager) GetOnlineCount() int {
	count := 0
	cm.clients.Range(func(k, v interface{}) bool {
		count++
		return true
	})
	return count
}

// 获取所有在线用户ID
func (cm *ConnectionManager) GetOnlineUsers() []int64 {
	var users []int64
	cm.clients.Range(func(k, v interface{}) bool {
		userID := k.(int64)
		users = append(users, userID)
		return true
	})
	return users
}

func (cm *ConnectionManager) SendToUser(userID int64, message interface{}) bool {
	client, exists := cm.GetClient(userID)
	if !exists {
		// 用户不在线，静默处理，不输出日志
		return false
	}

	// 使用写锁保证线程安全
	client.WriteMutex.Lock()
	defer client.WriteMutex.Unlock()

	// 检查连接是否已关闭
	if client.Closed {
		logger.GetLogger().Debugf("用户 %d 连接已关闭，跳过消息发送", userID)
		return false
	}

	data, err := json.Marshal(message)
	if err != nil {
		logger.GetLogger().Errorf("序列化消息失败: %v", err)
		return false
	}

	if err := client.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
		logger.GetLogger().Warnf("发送消息失败: %v", err)
		client.Closed = true // 标记连接已关闭
		cm.RemoveClient(userID) // 连接断开，移除客户端
		return false
	}

	// 移除频繁的日志输出，消息发送成功静默处理
	return true
}

// 批量发送消息
func (cm *ConnectionManager) SendToUsers(userIDs []int64, message interface{}) map[int64]bool {
	results := make(map[int64]bool)
	for _, userID := range userIDs {
		results[userID] = cm.SendToUser(userID, message)
	}
	return results
}

func (cm *ConnectionManager) Broadcast(message interface{}) {
	cm.clients.Range(func(k, v interface{}) bool {
		userID := k.(int64)
		cm.SendToUser(userID, message)
		return true
	})
}

// 广播给指定用户组
func (cm *ConnectionManager) BroadcastToGroup(userIDs []int64, message interface{}) {
	for _, userID := range userIDs {
		cm.SendToUser(userID, message)
	}
}

// 获取用户的上线状态
func (cm *ConnectionManager) IsOnline(userID int64) bool {
	_, exists := cm.clients.Load(userID)
	return exists
}

// 批量检查用户在线状态
func (cm *ConnectionManager) GetOnlineStatus(userIDs []int64) map[int64]bool {
	status := make(map[int64]bool)
	for _, userID := range userIDs {
		status[userID] = cm.IsOnline(userID)
	}
	return status
}

// 定期清理超时连接
func (cm *ConnectionManager) StartCleanup() {
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		for {
			<-ticker.C
			cm.cleanup()
		}
	}()
}

func (cm *ConnectionManager) cleanup() {
	now := time.Now()
	var timeoutUsers []int64

	cm.clients.Range(func(k, v interface{}) bool {
		client := v.(*ClientInfo)
		if now.Sub(client.LastPing) > 3*time.Minute {
			userID := k.(int64)
			timeoutUsers = append(timeoutUsers, userID)
			logger.GetLogger().Debugf("清理超时连接: 用户 %d，最后心跳: %v", userID, client.LastPing)
		}
		return true
	})

	// 清理超时用户
	for _, userID := range timeoutUsers {
		if client, exists := cm.GetClient(userID); exists {
			// 标记连接为已关闭
			client.WriteMutex.Lock()
			client.Closed = true
			client.WriteMutex.Unlock()

			client.Conn.Close()
			cm.RemoveClient(userID)
		}
	}
}
