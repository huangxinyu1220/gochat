package services

import (
	"database/sql"
	"time"

	"gorm.io/gorm"

	"gochat/internal/cache"
	"gochat/internal/database"
	"gochat/internal/logger"
	"gochat/internal/models"
)

type MessageService struct {
	db *gorm.DB
}

// MessageInfo 消息信息结构（包含用户信息）
type MessageInfo struct {
	ID         int64  `json:"id"`
	FromUserID int64  `json:"from_user_id"`
	ToUserID   *int64 `json:"to_user_id"`
	GroupID    *int64 `json:"group_id"`
	Content    string `json:"content"`
	MsgType    int    `json:"msg_type"`
	CreatedAt  int64  `json:"created_at"` // 改为int64毫秒时间戳

	// 发送者信息
	FromUser struct {
		ID       int64  `json:"id"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	} `json:"from_user"`
}

func NewMessageService() *MessageService {
	return &MessageService{
		db: database.GetDB(),
	}
}

// NewMessageServiceWithDB 创建消息服务（支持依赖注入）
func NewMessageServiceWithDB(db *gorm.DB) *MessageService {
	return &MessageService{
		db: db,
	}
}

// 保存消息 - 使用UTC时间，带缓存失效
func (s *MessageService) SaveMessage(msg *models.Message) (int64, error) {
	msg.CreatedAt = time.Now().UTC() // 使用UTC时间
	result := s.db.Create(msg)
	if result.Error != nil {
		return 0, result.Error
	}

	// 失效相关缓存
	cacheService := cache.GetCacheService()
	if cacheService != nil {
		if msg.GroupID != nil {
			// 群聊消息 - 失效群聊消息缓存
			if err := cacheService.InvalidateMessageCache(0, *msg.GroupID, true); err != nil {
				logger.GetLogger().Warnf("Failed to invalidate group message cache: %v", err)
			}
		} else if msg.ToUserID != nil {
			// 单聊消息 - 失效私聊消息缓存
			if err := cacheService.InvalidateMessageCache(msg.FromUserID, *msg.ToUserID, false); err != nil {
				logger.GetLogger().Warnf("Failed to invalidate private message cache: %v", err)
			}
		}

		// 更新最后一条消息缓存
		if msg.GroupID != nil {
			if err := cacheService.CacheLastMessage(0, *msg.GroupID, true, msg); err != nil {
				logger.GetLogger().Warnf("Failed to cache last group message: %v", err)
			}
		} else if msg.ToUserID != nil {
			if err := cacheService.CacheLastMessage(msg.FromUserID, *msg.ToUserID, false, msg); err != nil {
				logger.GetLogger().Warnf("Failed to cache last private message: %v", err)
			}
		}
	}

	return msg.ID, nil
}

// 获取单聊历史消息
func (s *MessageService) GetPrivateMessages(userID1, userID2 int64, page, pageSize int) ([]models.Message, int64, error) {
	var messages []models.Message
	var total int64

	// 计算偏移
	offset := (page - 1) * pageSize

	// 查询总数
	s.db.Model(&models.Message{}).
		Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
			userID1, userID2, userID2, userID1).
		Count(&total)

	// 查询消息，按时间倒序
	err := s.db.Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
		userID1, userID2, userID2, userID1).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&messages).Error

	return messages, total, err
}

// 获取群聊历史消息
func (s *MessageService) GetGroupMessages(groupID int64, page, pageSize int) ([]models.Message, int64, error) {
	var messages []models.Message
	var total int64

	offset := (page - 1) * pageSize

	// 查询总数
	s.db.Model(&models.Message{}).
		Where("group_id = ?", groupID).
		Count(&total)

	// 查询消息
	err := s.db.Where("group_id = ?", groupID).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&messages).Error

	return messages, total, err
}

// 获取会话的最后一条消息
func (s *MessageService) GetLastMessage(userID, targetID int64, isGroup bool) (*models.Message, error) {
	var msg models.Message

	query := s.db

	if isGroup {
		query = query.Where("group_id = ?", targetID)
	} else {
		query = query.Where("((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))",
			userID, targetID, targetID, userID)
	}

	err := query.Order("created_at DESC").First(&msg).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &msg, err
}

// 获取未读消息数量
func (s *MessageService) GetUnreadCount(userID, targetID int64, isGroup bool, lastReadTime time.Time) (int64, error) {
	var count int64

	query := s.db.Model(&models.Message{}).Where("created_at > ?", lastReadTime)

	if isGroup {
		query = query.Where("group_id = ? AND from_user_id != ?", targetID, userID)
	} else {
		query = query.Where("(from_user_id = ? AND to_user_id = ?)", targetID, userID)
	}

	err := query.Count(&count).Error
	return count, err
}

// 标记消息为已读
func (s *MessageService) MarkAsRead(userID, messageID int64) error {
	return s.db.Model(&models.Message{}).
		Where("id = ? AND to_user_id = ?", messageID, userID).
		Update("is_read", true).Error
}

// GetPrivateMessagesWithUserInfo 获取单聊历史消息（包含用户信息，带缓存）
func (s *MessageService) GetPrivateMessagesWithUserInfo(userID1, userID2 int64, page, pageSize int) ([]MessageInfo, int64, error) {
	// 尝试从缓存获取
	cacheService := cache.GetCacheService()
	if cacheService != nil {
		var cachedMessages []MessageInfo
		if err := cacheService.GetPrivateMessages(userID1, userID2, page, pageSize, &cachedMessages); err == nil && cachedMessages != nil {
			logger.GetLogger().Debugf("Cache hit for private messages between %d and %d, page %d", userID1, userID2, page)

			// 获取总数（可能需要单独缓存或者从数据库获取）
			var total int64
			s.db.Model(&models.Message{}).
				Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
					userID1, userID2, userID2, userID1).
				Count(&total)

			return cachedMessages, total, nil
		}
	}

	var messages []MessageInfo
	var total int64

	// 计算偏移
	offset := (page - 1) * pageSize

	// 查询总数
	s.db.Model(&models.Message{}).
		Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
			userID1, userID2, userID2, userID1).
		Count(&total)

	// 查询消息，按时间倒序，返回UTC时间戳（毫秒）
	rows, err := s.db.Raw(`
		SELECT
			m.id, m.from_user_id, m.to_user_id, m.group_id,
			m.content, m.msg_type,
			CAST(UNIX_TIMESTAMP(m.created_at) * 1000 AS SIGNED) as created_at,
			u.id as user_id, u.nickname as from_nickname, u.avatar as from_avatar
		FROM messages m
		JOIN users u ON m.from_user_id = u.id
		WHERE (m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?)
		ORDER BY m.created_at DESC
		LIMIT ? OFFSET ?
	`, userID1, userID2, userID2, userID1, pageSize, offset).Rows()

	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var msg MessageInfo
		var toUserID sql.NullInt64
		var groupID sql.NullInt64

		err := rows.Scan(
			&msg.ID, &msg.FromUserID, &toUserID, &groupID,
			&msg.Content, &msg.MsgType, &msg.CreatedAt,
			&msg.FromUser.ID, &msg.FromUser.Nickname, &msg.FromUser.Avatar,
		)
		if err != nil {
			logger.GetLogger().Errorf("Error scanning private message row: %v", err)
			return nil, 0, err
		}

		// 处理可空字段
		if toUserID.Valid {
			msg.ToUserID = &toUserID.Int64
		}
		if groupID.Valid {
			msg.GroupID = &groupID.Int64
		}

		messages = append(messages, msg)
	}

	// 缓存结果
	if cacheService != nil {
		if err := cacheService.CachePrivateMessages(userID1, userID2, page, pageSize, messages); err != nil {
			logger.GetLogger().Warnf("Failed to cache private messages: %v", err)
		}
	}

	return messages, total, nil
}

// GetGroupMessagesWithUserInfo 获取群聊历史消息（包含用户信息，带缓存）
func (s *MessageService) GetGroupMessagesWithUserInfo(groupID int64, page, pageSize int) ([]MessageInfo, int64, error) {
	// 尝试从缓存获取
	cacheService := cache.GetCacheService()
	if cacheService != nil {
		var cachedMessages []MessageInfo
		if err := cacheService.GetGroupMessages(groupID, page, pageSize, &cachedMessages); err == nil && cachedMessages != nil {
			logger.GetLogger().Debugf("Cache hit for group messages %d, page %d", groupID, page)

			// 获取总数
			var total int64
			s.db.Model(&models.Message{}).
				Where("group_id = ?", groupID).
				Count(&total)

			return cachedMessages, total, nil
		}
	}

	var messages []MessageInfo
	var total int64

	offset := (page - 1) * pageSize

	// 查询总数
	s.db.Model(&models.Message{}).
		Where("group_id = ?", groupID).
		Count(&total)

	// 查询消息，返回UTC时间戳（毫秒）
	rows, err := s.db.Raw(`
		SELECT
			m.id, m.from_user_id, m.to_user_id, m.group_id,
			m.content, m.msg_type,
			CAST(UNIX_TIMESTAMP(m.created_at) * 1000 AS SIGNED) as created_at,
			u.id as user_id, u.nickname as from_nickname, u.avatar as from_avatar
		FROM messages m
		JOIN users u ON m.from_user_id = u.id
		WHERE m.group_id = ?
		ORDER BY m.created_at DESC
		LIMIT ? OFFSET ?
	`, groupID, pageSize, offset).Rows()

	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var msg MessageInfo
		var toUserID sql.NullInt64
		var groupID sql.NullInt64

		err := rows.Scan(
			&msg.ID, &msg.FromUserID, &toUserID, &groupID,
			&msg.Content, &msg.MsgType, &msg.CreatedAt,
			&msg.FromUser.ID, &msg.FromUser.Nickname, &msg.FromUser.Avatar,
		)
		if err != nil {
			logger.GetLogger().Errorf("Error scanning group message row: %v", err)
			return nil, 0, err
		}

		// 处理可空字段
		if toUserID.Valid {
			msg.ToUserID = &toUserID.Int64
		}
		if groupID.Valid {
			msg.GroupID = &groupID.Int64
		}

		messages = append(messages, msg)
	}

	// 缓存结果
	if cacheService != nil {
		if err := cacheService.CacheGroupMessages(groupID, page, pageSize, messages); err != nil {
			logger.GetLogger().Warnf("Failed to cache group messages: %v", err)
		}
	}

	return messages, total, nil
}
