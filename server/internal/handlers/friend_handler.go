package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type FriendHandler struct {
	friendService *services.FriendService
}

func NewFriendHandler(cfg *config.Config) *FriendHandler {
	return &FriendHandler{
		friendService: services.NewFriendService(),
	}
}

// AddFriend 添加好友
func (h *FriendHandler) AddFriend(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	var req struct {
		FriendID int64 `json:"friend_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid request data"))
		return
	}

	err := h.friendService.AddFriend(userID.(int64), req.FriendID)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Friend added successfully"))
}

// RemoveFriend 删除好友
func (h *FriendHandler) RemoveFriend(c *gin.Context) {
	fmt.Printf("DEBUG: RemoveFriend function called\n")

	userID, exists := c.Get("user_id")
	if !exists {
		fmt.Printf("DEBUG: User not authenticated\n")
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	// 从URL路径获取friendID
	friendIDStr := c.Param("id")
	fmt.Printf("DEBUG: Friend ID string: %s\n", friendIDStr)

	friendID, err := strconv.ParseInt(friendIDStr, 10, 64)
	if err != nil {
		fmt.Printf("DEBUG: Invalid friend ID: %v\n", err)
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid friend ID"))
		return
	}

	fmt.Printf("DEBUG: Attempting to remove friend %d for user %d\n", friendID, userID.(int64))

	err = h.friendService.RemoveFriend(userID.(int64), friendID)
	if err != nil {
		fmt.Printf("DEBUG: Error removing friend: %v\n", err)
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	fmt.Printf("DEBUG: Friend removed successfully\n")
	c.JSON(http.StatusOK, utils.SuccessResponse("Friend removed successfully"))
}

// GetFriends 获取好友列表
func (h *FriendHandler) GetFriends(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	friends, err := h.friendService.GetFriends(userID.(int64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(friends))
}

// SearchUsers 搜索用户
func (h *FriendHandler) SearchUsers(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	keyword := c.Query("keyword")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Search keyword is required"))
		return
	}

	// 限制搜索结果数量（默认20，最大50）
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	users, err := h.friendService.SearchUsers(keyword, userID.(int64), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, err.Error()))
		return
	}

	// 为每个用户添加is_friend字段
	result := make([]map[string]interface{}, len(users))
	for i, user := range users {
		isFriend := h.friendService.IsFriend(userID.(int64), user.ID)
		result[i] = map[string]interface{}{
			"id":        user.ID,
			"phone":     user.Phone,
			"nickname":  user.Nickname,
			"avatar":    user.Avatar,
			"is_friend": isFriend,
		}
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(result))
}
