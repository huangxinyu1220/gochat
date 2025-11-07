package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/models"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type MessageHandler struct {
	messageService *services.MessageService
}

func NewMessageHandler(cfg *config.Config) *MessageHandler {
	return &MessageHandler{
		messageService: services.NewMessageService(),
	}
}

// GetMessages 获取历史消息
func (h *MessageHandler) GetMessages(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	// 获取参数：可以通过target_id+type或conversation_id查询
	targetIDStr := c.Query("target_id")
	conversationTypeStr := c.Query("type") // 1-单聊, 2-群聊
	conversationIDStr := c.Query("conversation_id")

	// 分页参数
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var messages []services.MessageInfo
	var total int64

	if targetIDStr != "" && conversationTypeStr != "" {
		// 通过target_id和type查询
		targetID, err := strconv.ParseInt(targetIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid target_id"))
			return
		}

		conversationType, err := strconv.Atoi(conversationTypeStr)
		if err != nil || (conversationType != models.ConversationTypePrivate && conversationType != models.ConversationTypeGroup) {
			c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid type, must be 1 or 2"))
			return
		}

		if conversationType == models.ConversationTypePrivate {
			// 单聊
			messages, total, err = h.messageService.GetPrivateMessagesWithUserInfo(userID.(int64), targetID, page, pageSize)
		} else {
			// 群聊
			messages, total, err = h.messageService.GetGroupMessagesWithUserInfo(targetID, page, pageSize)
		}
	} else if conversationIDStr != "" {
		// 通过conversation_id查询（需要先获取会话信息）
		conversationID, err := strconv.ParseInt(conversationIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid conversation_id"))
			return
		}

		// 获取会话信息
		conversationService := services.NewConversationService()
		conversation, err := conversationService.GetConversationByID(conversationID, userID.(int64))
		if err != nil {
			c.JSON(http.StatusNotFound, utils.ErrorResponse(404, "Conversation not found"))
			return
		}

		if conversation.Type == models.ConversationTypePrivate {
			// 单聊
			messages, total, err = h.messageService.GetPrivateMessagesWithUserInfo(userID.(int64), conversation.TargetID, page, pageSize)
		} else {
			// 群聊
			messages, total, err = h.messageService.GetGroupMessagesWithUserInfo(conversation.TargetID, page, pageSize)
		}
	} else {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Either (target_id and type) or conversation_id is required"))
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, err.Error()))
		return
	}

	// 构建响应
	result := gin.H{
		"messages": messages,
		"pagination": gin.H{
			"page":       page,
			"page_size":  pageSize,
			"total":      total,
			"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(result))
}
