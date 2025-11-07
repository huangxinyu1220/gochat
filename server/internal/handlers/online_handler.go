package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/websocket"
)

type OnlineHandler struct {
	cfg *config.Config
}

func NewOnlineHandler(cfg *config.Config) *OnlineHandler {
	return &OnlineHandler{cfg: cfg}
}

// GetOnlineStatus 获取用户在线状态
func (h *OnlineHandler) GetOnlineStatus(c *gin.Context) {
	// 获取用户ID列表参数
	userIDsParam := c.Query("user_ids")
	if userIDsParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_ids parameter is required"})
		return
	}

	// 解析用户ID列表
	userIDStrings := strings.Split(userIDsParam, ",")
	var userIDs []int64
	for _, idStr := range userIDStrings {
		id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id format"})
			return
		}
		userIDs = append(userIDs, id)
	}

	// 获取在线状态
	status := websocket.Manager.GetOnlineStatus(userIDs)

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"message": "success",
		"data": status,
	})
}

// GetOnlineUsers 获取所有在线用户
func (h *OnlineHandler) GetOnlineUsers(c *gin.Context) {
	onlineUsers := websocket.Manager.GetOnlineUsers()

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"message": "success",
		"data": gin.H{
			"online_users": onlineUsers,
			"count": len(onlineUsers),
		},
	})
}

// GetOnlineCount 获取在线用户数量
func (h *OnlineHandler) GetOnlineCount(c *gin.Context) {
	count := websocket.Manager.GetOnlineCount()

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"message": "success",
		"data": gin.H{
			"count": count,
		},
	})
}