package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type ConversationHandler struct {
	conversationService *services.ConversationService
}

func NewConversationHandler(cfg *config.Config) *ConversationHandler {
	return &ConversationHandler{
		conversationService: services.NewConversationService(),
	}
}

// GetConversations 获取会话列表
func (h *ConversationHandler) GetConversations(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	conversations, err := h.conversationService.GetConversations(userID.(int64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(conversations))
}

// ClearUnreadCount 清空未读计数
func (h *ConversationHandler) ClearUnreadCount(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	conversationIDStr := c.Param("id")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid conversation ID"))
		return
	}

	err = h.conversationService.ClearUnreadCount(userID.(int64), conversationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Unread count cleared"))
}
