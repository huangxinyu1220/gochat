package websocket

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"

	"gochat/internal/config"
	"gochat/internal/logger"
	"gochat/internal/models"
	"gochat/internal/services"
)

// WebSocket消息格式
type WSMessage struct {
	Type    string      `json:"type"`    // ping | pong | chat
	Action  string      `json:"action"`  // send | receive | online | offline
	MsgID   string      `json:"msg_id,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// 聊天消息数据结构
type ChatMessage struct {
	ToUserID   *int64  `json:"to_user_id,omitempty"`   // 单聊接收者ID
	GroupID    *int64  `json:"group_id,omitempty"`     // 群聊群组ID
	Content    string  `json:"content"`                // 消息内容
	MsgType    int     `json:"msg_type,omitempty"`     // 消息类型：1-文本 2-图片
	ContentType string `json:"content_type,omitempty"` // 文本、图片等（已废弃，使用msg_type）
}

// 处理WebSocket连接请求
func WebSocketHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从查询参数中获取Token
		tokenStr := c.Query("token")
		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "token required"})
			return
		}

		// 验证JWT Token (从配置中获取密钥)
		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWT.Secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// 从JWT中提取用户信息
		claims := token.Claims.(jwt.MapClaims)
		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user_id"})
			return
		}
		userID := int64(userIDFloat)
		username, _ := claims["username"].(string)

		// 升级为WebSocket连接
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			logger.GetLogger().Infof("WebSocket升级失败: %v", err)
			return
		}
		defer conn.Close()

		// 创建客户端信息
		clientID := generateClientID()
		client := &ClientInfo{
			ID:       clientID,
			UserID:   userID,
			Username: username,
			Conn:     conn,
			LastPing: time.Now(),
		}

		// 添加到连接管理器
		Manager.AddClient(client)
		defer Manager.RemoveClient(userID)

		// 广播用户上线状态给好友
		go broadcastUserOnlineStatus(userID, true)
		defer func() {
			// 广播用户下线状态给好友
			go broadcastUserOnlineStatus(userID, false)
		}()

		// 启动心跳检测协程
		go startHeartbeat(client)

		// 发送连接成功消息 - 使用线程安全的SendToUser方法
		connectMessage := WSMessage{
			Type:   "system",
			Action: "connected",
			Data: gin.H{
				"user_id":   userID,
				"username":  username,
				"client_id": clientID,
			},
		}
		Manager.SendToUser(userID, connectMessage)

		// 消息处理循环
		for {
			var wsMsg WSMessage
			err := conn.ReadJSON(&wsMsg)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					logger.GetLogger().Infof("WebSocket错误: %v", err)
				}
				break
			}

			// 处理消息
			handleMessage(client, &wsMsg)
		}
	}
}

// 处理消息
func handleMessage(client *ClientInfo, message *WSMessage) {
	switch message.Type {
	case "ping":
		handlePing(client)
	case "pong":
		handlePong(client)
	case "chat":
		handleChatMessage(client, message)
	default:
		logger.GetLogger().Infof("未知消息类型: %s", message.Type)
	}
}

// 处理心跳包
func handlePing(client *ClientInfo) {
	client.LastPing = time.Now()

	// 回复pong - 使用线程安全的SendToUser方法
	response := WSMessage{
		Type:   "pong",
		Action: "response",
		Data:   gin.H{"timestamp": time.Now().Unix()},
	}

	Manager.SendToUser(client.UserID, response)
}

// 处理pong响应
func handlePong(client *ClientInfo) {
	// 客户端回复pong，更新心跳时间
	client.LastPing = time.Now()
}

// 聊天消息验证数据结构
type ChatData struct {
	Content    string `json:"content"`
	MsgType    int    `json:"msg_type"`
	ToUserID   *int64 `json:"to_user_id,omitempty"`
	GroupID    *int64 `json:"group_id,omitempty"`
}

// validateChatData 验证聊天消息数据
func validateChatData(client *ClientInfo, message *WSMessage) (*ChatData, bool) {
	if message.Action != "send" {
		return nil, false
	}

	// 解析聊天数据
	chatDataMap, ok := message.Data.(map[string]interface{})
	if !ok {
		sendError(client, message.MsgID, "invalid chat data")
		return nil, false
	}

	// 验证内容
	content, ok := chatDataMap["content"].(string)
	if !ok || strings.TrimSpace(content) == "" {
		sendError(client, message.MsgID, "content is required")
		return nil, false
	}

	// 获取消息类型，默认为文本消息
	msgType := models.MessageTypeText
	if msgTypeFloat, exists := chatDataMap["msg_type"]; exists {
		if msgTypeVal, ok := msgTypeFloat.(float64); ok {
			msgType = int(msgTypeVal)
		}
	}

	chatData := &ChatData{
		Content: content,
		MsgType: msgType,
	}

	// 解析接收者信息
	if toUserID, exists := chatDataMap["to_user_id"]; exists {
		if toUserIDFloat, ok := toUserID.(float64); ok {
			toUserIDInt := int64(toUserIDFloat)
			chatData.ToUserID = &toUserIDInt
		}
	} else if groupID, exists := chatDataMap["group_id"]; exists {
		if groupIDFloat, ok := groupID.(float64); ok {
			groupIDInt := int64(groupIDFloat)
			chatData.GroupID = &groupIDInt
		}
	} else {
		sendError(client, message.MsgID, "to_user_id or group_id is required")
		return nil, false
	}

	return chatData, true
}

// createMessageRecord 创建消息记录
func createMessageRecord(client *ClientInfo, chatData *ChatData) *models.Message {
	msg := &models.Message{
		FromUserID: client.UserID,
		Content:    chatData.Content,
		MsgType:    chatData.MsgType,
		CreatedAt:  time.Now().UTC(),
	}

	if chatData.ToUserID != nil {
		msg.ToUserID = chatData.ToUserID
	} else if chatData.GroupID != nil {
		msg.GroupID = chatData.GroupID
	}

	return msg
}

// determineRecipients 确定消息接收者列表
func determineRecipients(client *ClientInfo, chatData *ChatData, msgID string) ([]int64, bool) {
	var recipients []int64

	if chatData.ToUserID != nil {
		// 单聊
		recipients = []int64{*chatData.ToUserID}
	} else if chatData.GroupID != nil {
		// 群聊 - 获取群成员列表
		groupService := services.NewGroupService()
		members, err := groupService.GetGroupMembers(*chatData.GroupID)
		if err != nil {
			sendError(client, msgID, "failed to get group members")
			return nil, false
		}

		// 排除发送者自己
		for _, member := range members {
			if member.UserID != client.UserID {
				recipients = append(recipients, member.UserID)
			}
		}
	}

	return recipients, true
}

// saveMessageAndUpdateConversation 保存消息并更新会话信息
func saveMessageAndUpdateConversation(client *ClientInfo, msg *models.Message, recipients []int64, msgID string) (int64, bool) {
	// 保存消息到数据库
	messageService := services.NewMessageService()
	messageID, err := messageService.SaveMessage(msg)
	if err != nil {
		logger.GetLogger().Infof("保存消息失败: %v", err)
		sendError(client, msgID, "save message failed")
		return 0, false
	}

	// 更新会话信息
	conversationService := services.NewConversationService()
	if msg.ToUserID != nil {
		// 单聊：更新双方的会话
		conversationService.UpdateLastMessage(client.UserID, *msg.ToUserID, messageID, msg.Content)
		conversationService.UpdateLastMessage(*msg.ToUserID, client.UserID, messageID, msg.Content)
		// 为接收者增加未读计数
		conversationService.IncrementUnreadCount(*msg.ToUserID, client.UserID, models.ConversationTypePrivate)
	} else if msg.GroupID != nil {
		// 群聊：更新所有群成员的会话
		for _, recipientID := range recipients {
			conversationService.UpdateLastMessage(recipientID, *msg.GroupID, messageID, msg.Content)
			// 为接收者增加未读计数
			conversationService.IncrementUnreadCount(recipientID, *msg.GroupID, models.ConversationTypeGroup)
		}
		// 也更新发送者的会话
		conversationService.UpdateLastMessage(client.UserID, *msg.GroupID, messageID, msg.Content)
	}

	return messageID, true
}

// buildAndBroadcastMessage 构建并广播消息给接收者
func buildAndBroadcastMessage(client *ClientInfo, msg *models.Message, messageID int64, recipients []int64, msgID string) {
	// 获取发送者的完整用户信息（使用缓存）
	userCacheService := services.GetUserCacheService()
	fromUser, userErr := userCacheService.GetUser(client.UserID)
	if userErr != nil {
		logger.GetLogger().Errorf("获取用户信息失败: %v", userErr)
		// 如果获取用户信息失败，使用客户端的基本信息
		fromUser = &models.User{
			ID:       client.UserID,
			Nickname: client.Username,
		}
	}

	// 推送给接收者
	onlineCount := 0
	offlineCount := 0
	for _, recipientID := range recipients {
		if recipientID != client.UserID { // 不给自己发
			pushData := gin.H{
				"message_id":   messageID,
				"from_user_id": client.UserID,
				"content":      msg.Content,
				"msg_type":     msg.MsgType,
				"created_at":   time.Now().UTC().UnixMilli(),
				"from_user": gin.H{
					"id":       fromUser.ID,
					"nickname": fromUser.Nickname,
					"avatar":   fromUser.Avatar,
				},
			}

			// 如果是群聊，添加group_id字段
			if msg.GroupID != nil {
				pushData["group_id"] = *msg.GroupID
			}

			pushMessage := WSMessage{
				Type:   "chat",
				Action: "receive",
				MsgID:  msgID,
				Data:   pushData,
			}
			if Manager.SendToUser(recipientID, pushMessage) {
				onlineCount++
			} else {
				offlineCount++
			}
		}
	}

	// 记录日志
	if len(recipients) > 1 { // 群聊
		logger.GetLogger().Infof("群聊消息发送完成，消息ID: %d，在线用户: %d，离线用户: %d", messageID, onlineCount, offlineCount)
	} else { // 单聊
		if onlineCount > 0 {
			logger.GetLogger().Infof("单聊消息实时发送成功，消息ID: %d，接收者在线", messageID)
		} else {
			logger.GetLogger().Infof("单聊消息已保存，消息ID: %d，接收者离线，等待上线后拉取", messageID)
		}
	}
}

// 处理聊天消息
func handleChatMessage(client *ClientInfo, message *WSMessage) {
	// 0. 检查速率限制
	if !Manager.CheckRateLimit(client.UserID) {
		// 发送速率限制错误消息给用户
		errorResponse := WSMessage{
			Type:   "error",
			Action: "rate_limit_exceeded",
			MsgID:  message.MsgID,
			Data: gin.H{
				"error":   "Rate limit exceeded",
				"message": "您发送消息过于频繁，请稍后再试",
			},
		}
		Manager.SendToUser(client.UserID, errorResponse)
		logger.GetLogger().Warnf("用户 %d 触发WebSocket消息速率限制", client.UserID)
		return
	}

	// 1. 验证聊天数据
	chatData, ok := validateChatData(client, message)
	if !ok {
		return
	}

	// 2. 创建消息记录
	msg := createMessageRecord(client, chatData)

	// 3. 确定接收者列表
	recipients, ok := determineRecipients(client, chatData, message.MsgID)
	if !ok {
		return
	}

	// 4. 保存消息并更新会话信息
	messageID, ok := saveMessageAndUpdateConversation(client, msg, recipients, message.MsgID)
	if !ok {
		return
	}

	// 5. 发送成功确认给发送者
	sendACK(client, message.MsgID, messageID)

	// 6. 构建并广播消息给接收者
	buildAndBroadcastMessage(client, msg, messageID, recipients, message.MsgID)
}

// 发送错误消息
func sendError(client *ClientInfo, msgID, errorMsg string) {
	errorResponse := WSMessage{
		Type:   "error",
		Action: "error",
		MsgID:  msgID,
		Data:   gin.H{"error": errorMsg},
	}
	Manager.SendToUser(client.UserID, errorResponse)
}

// 发送ACK确认
func sendACK(client *ClientInfo, msgID string, messageID int64) {
	ackResponse := WSMessage{
		Type:   "chat",
		Action: "ack",
		MsgID:  msgID,
		Data:   gin.H{"message_id": messageID},
	}
	Manager.SendToUser(client.UserID, ackResponse)
}

// 启动心跳检测
func startHeartbeat(client *ClientInfo) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 每30秒发送ping
			pingMsg := WSMessage{
				Type:   "ping",
				Action: "ping",
				Data:   gin.H{"timestamp": time.Now().Unix()},
			}
			Manager.SendToUser(client.UserID, pingMsg)

			// 检查是否超时 - 允许更长的超时时间
			if time.Since(client.LastPing) > 180*time.Second {
				logger.GetLogger().Infof("用户 %d 心跳超时，断开连接", client.UserID)
				client.Conn.Close()
				return
			}
		}
	}
}

// 生成客户端ID
func generateClientID() string {
	return "client_" + strconv.FormatInt(time.Now().UnixNano(), 16)
}

// 广播用户在线状态给好友
func broadcastUserOnlineStatus(userID int64, isOnline bool) {
	// 获取用户的好友列表
	friendService := services.NewFriendService()
	friends, err := friendService.GetFriendIDs(userID)
	if err != nil {
		logger.GetLogger().Infof("获取用户 %d 的好友列表失败: %v", userID, err)
		return
	}

	// 构造在线状态消息
	statusMessage := WSMessage{
		Type:   "status",
		Action: "online_status",
		Data: gin.H{
			"user_id":   userID,
			"is_online": isOnline,
			"timestamp": time.Now().Unix(),
		},
	}

	// 向在线好友广播状态
	for _, friendID := range friends {
		if Manager.IsOnline(friendID) {
			Manager.SendToUser(friendID, statusMessage)
		}
	}
}
