package services

import (
	"time"

	"gorm.io/gorm"

	"gochat/internal/database"
	"gochat/internal/models"
)

type ConversationService struct {
	db *gorm.DB
}

func NewConversationService() *ConversationService {
	return &ConversationService{
		db: database.GetDB(),
	}
}

// NewConversationServiceWithDB 创建会话服务（支持依赖注入）
func NewConversationServiceWithDB(db *gorm.DB) *ConversationService {
	return &ConversationService{
		db: db,
	}
}

type ConversationInfo struct {
	ID             int64  `json:"id"`
	Type           int    `json:"type"`
	TargetID       int64  `json:"target_id"`
	TargetName     string `json:"target_name"`
	TargetAvatar   string `json:"target_avatar"`
	LastMsgContent string `json:"last_msg_content"`
	LastMsgType    int    `json:"last_msg_type"`
	LastMsgTime    string `json:"last_msg_time"`
	UnreadCount    int    `json:"unread_count"`
}

// GetConversations 获取用户的会话列表
func (s *ConversationService) GetConversations(userID int64) ([]ConversationInfo, error) {
	var conversations []ConversationInfo

	rows, err := s.db.Raw(`
		SELECT
			c.id,
			c.type,
			c.target_id,
			c.unread_count,
			CASE
				WHEN c.type = 1 THEN u.nickname
				WHEN c.type = 2 THEN g.name
				ELSE 'Unknown'
			END as target_name,
			CASE
				WHEN c.type = 1 THEN u.avatar
				WHEN c.type = 2 THEN 'default_group.png'
				ELSE 'default.png'
			END as target_avatar,
			COALESCE(m.content, '暂无消息') as last_msg_content,
			COALESCE(m.msg_type, 1) as last_msg_type,
			COALESCE(DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s'), '') as last_msg_time
		FROM conversations c
		LEFT JOIN users u ON c.type = 1 AND c.target_id = u.id
		LEFT JOIN ` + "`groups`" + ` g ON c.type = 2 AND c.target_id = g.id
		LEFT JOIN group_members gm ON c.type = 2 AND c.target_id = gm.group_id AND gm.user_id = c.user_id
		LEFT JOIN messages m ON c.last_msg_id = m.id
		WHERE c.user_id = ?
		AND (
			c.type = 1
			OR (c.type = 2 AND gm.user_id IS NOT NULL)
		)
		ORDER BY c.updated_at DESC
	`, userID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var conv ConversationInfo
		err := rows.Scan(
			&conv.ID,
			&conv.Type,
			&conv.TargetID,
			&conv.UnreadCount,
			&conv.TargetName,
			&conv.TargetAvatar,
			&conv.LastMsgContent,
			&conv.LastMsgType,
			&conv.LastMsgTime,
		)
		if err != nil {
			return nil, err
		}
		conversations = append(conversations, conv)
	}

	return conversations, nil
}

// ClearUnreadCount 清空未读计数
func (s *ConversationService) ClearUnreadCount(userID, conversationID int64) error {
	return s.db.Model(&models.Conversation{}).
		Where("id = ? AND user_id = ?", conversationID, userID).
		Update("unread_count", 0).Error
}

// UpdateLastMessage 更新会话的最后一条消息
func (s *ConversationService) UpdateLastMessage(userID, targetID, messageID int64, content string) error {
	// 判断会话类型（单聊还是群聊）
	conversationType := models.ConversationTypePrivate // 默认单聊
	// 如果targetID对应的是群组，则为群聊
	var groupExists bool
	s.db.Raw("SELECT EXISTS(SELECT 1 FROM `groups` WHERE id = ?)", targetID).Scan(&groupExists)
	if groupExists {
		conversationType = models.ConversationTypeGroup
	}

	// 查找或创建会话
	var conversation models.Conversation
	err := s.db.Where("user_id = ? AND type = ? AND target_id = ?", userID, conversationType, targetID).
		First(&conversation).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新会话
		conversation = models.Conversation{
			UserID:      userID,
			Type:        conversationType,
			TargetID:    targetID,
			LastMsgID:   &messageID,
			UnreadCount: 0, // 新会话未读计数为0
			UpdatedAt:   time.Now(),
		}
		return s.db.Create(&conversation).Error
	} else if err != nil {
		return err
	}

	// 更新现有会话
	updates := map[string]interface{}{
		"last_msg_id": messageID,
		"updated_at":  time.Now(),
	}

	return s.db.Model(&conversation).Updates(updates).Error
}

// IncrementUnreadCount 增加未读计数 (用于消息接收者)
func (s *ConversationService) IncrementUnreadCount(userID, targetID int64, conversationType int) error {
	return s.db.Model(&models.Conversation{}).
		Where("user_id = ? AND type = ? AND target_id = ?", userID, conversationType, targetID).
		Update("unread_count", gorm.Expr("unread_count + 1")).Error
}

// CreateOrUpdateConversation 创建或更新会话
func (s *ConversationService) CreateOrUpdateConversation(userID, targetID int64, conversationType int) (*models.Conversation, error) {
	var conversation models.Conversation
	err := s.db.Where("user_id = ? AND type = ? AND target_id = ?", userID, conversationType, targetID).
		First(&conversation).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新会话
		conversation = models.Conversation{
			UserID:      userID,
			Type:        conversationType,
			TargetID:    targetID,
			UnreadCount: 0,
			UpdatedAt:   time.Now(),
		}
		err = s.db.Create(&conversation).Error
		return &conversation, err
	}

	return &conversation, err
}

// GetConversationByID 根据ID获取会话信息
func (s *ConversationService) GetConversationByID(conversationID, userID int64) (*models.Conversation, error) {
	var conversation models.Conversation
	err := s.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error
	if err != nil {
		return nil, err
	}
	return &conversation, nil
}
