package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type GroupHandler struct {
	groupService        *services.GroupService
	conversationService *services.ConversationService
}

func NewGroupHandler(cfg *config.Config) *GroupHandler {
	return &GroupHandler{
		groupService:        services.NewGroupService(),
		conversationService: services.NewConversationService(),
	}
}

// CreateGroupRequest 创建群组请求
type CreateGroupRequest struct {
	Name      string  `json:"name" binding:"required"`
	MemberIDs []int64 `json:"member_ids" binding:"required,min=1"`
}

// AddGroupMembersRequest 添加群成员请求
type AddGroupMembersRequest struct {
	UserIDs []int64 `json:"user_ids" binding:"required,min=1"`
}

// CreateGroup 创建群组
func (h *GroupHandler) CreateGroup(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	var req CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid request data"))
		return
	}

	// 创建群组
	group, err := h.groupService.CreateGroupWithMembers(userID.(int64), req.Name, req.MemberIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to create group: "+err.Error()))
		return
	}

	// 为所有成员创建会话
	allMemberIDs := append([]int64{userID.(int64)}, req.MemberIDs...)
	for _, memberID := range allMemberIDs {
		_, err := h.conversationService.CreateOrUpdateConversation(memberID, group.ID, 2)
		if err != nil {
			// 记录错误但不阻断流程
			c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to create conversation: "+err.Error()))
			return
		}
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(group))
}

// GetGroup 获取群组详情
func (h *GroupHandler) GetGroup(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	groupIDStr := c.Param("id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid group ID"))
		return
	}

	// 检查用户是否在群中
	inGroup, err := h.groupService.IsUserInGroup(userID.(int64), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to check group membership"))
		return
	}
	if !inGroup {
		c.JSON(http.StatusForbidden, utils.ErrorResponse(403, "You are not a member of this group"))
		return
	}

	// 获取群组信息
	group, err := h.groupService.GetGroup(groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, utils.ErrorResponse(404, "Group not found"))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(group))
}

// GetGroupMembers 获取群成员列表
func (h *GroupHandler) GetGroupMembers(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	groupIDStr := c.Param("id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid group ID"))
		return
	}

	// 检查用户是否在群中
	inGroup, err := h.groupService.IsUserInGroup(userID.(int64), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to check group membership"))
		return
	}
	if !inGroup {
		c.JSON(http.StatusForbidden, utils.ErrorResponse(403, "You are not a member of this group"))
		return
	}

	// 获取群成员详细信息（已包含is_owner字段）
	members, err := h.groupService.GetGroupMembersWithUserInfo(groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to get group members"))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(members))
}

// AddGroupMembers 添加群成员
func (h *GroupHandler) AddGroupMembers(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	groupIDStr := c.Param("id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid group ID"))
		return
	}

	// 检查用户是否在群中
	inGroup, err := h.groupService.IsUserInGroup(userID.(int64), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to check group membership"))
		return
	}
	if !inGroup {
		c.JSON(http.StatusForbidden, utils.ErrorResponse(403, "You are not a member of this group"))
		return
	}

	var req AddGroupMembersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid request data"))
		return
	}

	// 添加群成员
	err = h.groupService.AddGroupMembers(groupID, req.UserIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, err.Error()))
		return
	}

	// 为新成员创建会话
	for _, memberID := range req.UserIDs {
		_, err := h.conversationService.CreateOrUpdateConversation(memberID, groupID, 2)
		if err != nil {
			// 记录错误但不阻断流程
			continue
		}
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Members added successfully"))
}
