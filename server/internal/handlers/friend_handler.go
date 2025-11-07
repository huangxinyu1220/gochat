package handlers

import (
	"net/http"

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
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 验证并绑定请求数据
	var req struct {
		FriendID int64 `json:"friend_id" binding:"required"`
	}
	if !utils.ValidateAndBindJSON(c, &req) {
		return
	}

	// 调用服务层
	if err := h.friendService.AddFriend(userID, req.FriendID); err != nil {
		utils.HandleBadRequestError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Friend added successfully"))
}

// RemoveFriend 删除好友
func (h *FriendHandler) RemoveFriend(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 解析好友ID参数
	friendID, err := utils.ParseInt64Param(c, "id")
	if err != nil {
		utils.HandleParseError(c, "friend ID")
		return
	}

	// 调用服务层
	if err := h.friendService.RemoveFriend(userID, friendID); err != nil {
		utils.HandleBadRequestError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Friend removed successfully"))
}

// GetFriends 获取好友列表
func (h *FriendHandler) GetFriends(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 调用服务层
	friends, err := h.friendService.GetFriends(userID)
	if err != nil {
		utils.HandleInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(friends))
}

// SearchUsers 搜索用户
func (h *FriendHandler) SearchUsers(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 验证必需的搜索关键词
	keyword, ok := utils.ValidateRequiredQuery(c, "keyword", "Search keyword")
	if !ok {
		return
	}

	// 解析限制参数（默认20，最大50）
	limit := utils.ParseIntQuery(c, "limit", 20)
	if limit > 50 {
		limit = 50
	}

	// 调用服务层
	users, err := h.friendService.SearchUsers(keyword, userID, limit)
	if err != nil {
		utils.HandleInternalError(c, err)
		return
	}

	// 为每个用户添加is_friend字段
	result := make([]map[string]interface{}, len(users))
	for i, user := range users {
		isFriend := h.friendService.IsFriend(userID, user.ID)
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
