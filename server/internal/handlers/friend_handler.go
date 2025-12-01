package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type FriendHandler struct {
	friendService        *services.FriendService
	friendRequestService *services.FriendRequestService
}

func NewFriendHandler(cfg *config.Config) *FriendHandler {
	return &FriendHandler{
		friendService:        services.NewFriendService(),
		friendRequestService: services.NewFriendRequestService(),
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

	// 收集所有用户ID用于批量查询
	userIDs := make([]int64, len(users))
	for i, user := range users {
		userIDs[i] = user.ID
	}

	// 批量获取申请状态
	requestStatusMap, err := h.friendRequestService.GetRequestStatusBatch(userID, userIDs)
	if err != nil {
		utils.HandleInternalError(c, err)
		return
	}

	// 为每个用户添加is_friend和request_status字段
	result := make([]map[string]interface{}, len(users))
	for i, user := range users {
		isFriend := h.friendService.IsFriend(userID, user.ID)
		statusInfo := requestStatusMap[user.ID]

		result[i] = map[string]interface{}{
			"id":             user.ID,
			"phone":          user.Phone,
			"nickname":       user.Nickname,
			"avatar":         user.Avatar,
			"is_friend":      isFriend,
			"request_status": statusInfo.Status,    // "none", "sent", "received"
			"request_id":     statusInfo.RequestID, // 申请ID（用于同意操作）
		}
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(result))
}

// SendFriendRequest 发送好友申请
func (h *FriendHandler) SendFriendRequest(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 验证并绑定请求数据
	var req struct {
		ToUserID int64  `json:"to_user_id" binding:"required"`
		Message  string `json:"message"`
	}
	if !utils.ValidateAndBindJSON(c, &req) {
		return
	}

	// 限制消息长度
	if len(req.Message) > 20 {
		utils.HandleBadRequestError(c, "message too long (max 20 characters)")
		return
	}

	// 调用服务层
	request, err := h.friendRequestService.SendRequest(userID, req.ToUserID, req.Message)
	if err != nil {
		utils.HandleBadRequestError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(map[string]interface{}{
		"request_id": request.ID,
		"to_user_id": request.ToUserID,
		"status":     request.Status,
		"created_at": request.CreatedAt,
	}))
}

// GetReceivedRequests 获取收到的好友申请
func (h *FriendHandler) GetReceivedRequests(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 解析分页参数
	page := utils.ParseIntQuery(c, "page", 1)
	pageSize := utils.ParseIntQuery(c, "page_size", 20)

	// 解析状态筛选参数（可选）
	var status *int
	if statusStr := c.Query("status"); statusStr != "" {
		s := utils.ParseIntQuery(c, "status", 0)
		status = &s
	}

	// 调用服务层
	requests, total, err := h.friendRequestService.GetReceivedRequests(userID, status, page, pageSize)
	if err != nil {
		utils.HandleInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(map[string]interface{}{
		"total": total,
		"items": requests,
	}))
}

// GetSentRequests 获取发出的好友申请
func (h *FriendHandler) GetSentRequests(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 解析分页参数
	page := utils.ParseIntQuery(c, "page", 1)
	pageSize := utils.ParseIntQuery(c, "page_size", 20)

	// 解析状态筛选参数（可选）
	var status *int
	if statusStr := c.Query("status"); statusStr != "" {
		s := utils.ParseIntQuery(c, "status", 0)
		status = &s
	}

	// 调用服务层
	requests, total, err := h.friendRequestService.GetSentRequests(userID, status, page, pageSize)
	if err != nil {
		utils.HandleInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(map[string]interface{}{
		"total": total,
		"items": requests,
	}))
}

// AcceptFriendRequest 同意好友申请
func (h *FriendHandler) AcceptFriendRequest(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 解析申请ID参数
	requestID, err := utils.ParseInt64Param(c, "id")
	if err != nil {
		utils.HandleParseError(c, "request ID")
		return
	}

	// 调用服务层
	if err := h.friendRequestService.AcceptRequest(requestID, userID); err != nil {
		utils.HandleBadRequestError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Friend request accepted"))
}

// RejectFriendRequest 拒绝好友申请
func (h *FriendHandler) RejectFriendRequest(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 解析申请ID参数
	requestID, err := utils.ParseInt64Param(c, "id")
	if err != nil {
		utils.HandleParseError(c, "request ID")
		return
	}

	// 调用服务层
	if err := h.friendRequestService.RejectRequest(requestID, userID); err != nil {
		utils.HandleBadRequestError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Friend request rejected"))
}

// CancelFriendRequest 取消好友申请
func (h *FriendHandler) CancelFriendRequest(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 解析申请ID参数
	requestID, err := utils.ParseInt64Param(c, "id")
	if err != nil {
		utils.HandleParseError(c, "request ID")
		return
	}

	// 调用服务层
	if err := h.friendRequestService.CancelRequest(requestID, userID); err != nil {
		utils.HandleBadRequestError(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Friend request canceled"))
}

// GetPendingRequestCount 获取待处理的好友申请数量
func (h *FriendHandler) GetPendingRequestCount(c *gin.Context) {
	// 验证用户认证
	userID, ok := utils.RequireAuthentication(c)
	if !ok {
		return
	}

	// 调用服务层
	count, err := h.friendRequestService.GetPendingCount(userID)
	if err != nil {
		utils.HandleInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(map[string]interface{}{
		"count": count,
	}))
}
