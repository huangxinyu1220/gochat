package services

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gochat/internal/database"
	"gochat/internal/logger"
	"gochat/internal/models"
)

type FriendService struct {
	db *gorm.DB
}

func NewFriendService() *FriendService {
	return &FriendService{
		db: database.GetDB(),
	}
}

// NewFriendServiceWithDB 创建好友服务（支持依赖注入）
func NewFriendServiceWithDB(db *gorm.DB) *FriendService {
	return &FriendService{
		db: db,
	}
}

type FriendInfo struct {
	ID        int64  `json:"id"`
	Phone     string `json:"phone"`
	Nickname  string `json:"nickname"`
	Avatar    string `json:"avatar"`
	Gender    int    `json:"gender"`    // 0-未设置 1-男 2-女
	Signature string `json:"signature"` // 个性签名
}

// checkFriendshipExists 高效检查好友关系是否存在
func (s *FriendService) checkFriendshipExists(userID, friendID int64) (bool, error) {
	var count int64

	// 使用超时控制和优化的查询
	err := database.QueryWithTimeout(3*time.Second, func(db *gorm.DB) error {
		// 使用UNION查询，比OR更高效
		return db.Raw(`
			SELECT COUNT(*) FROM (
				SELECT 1 FROM friend_relations WHERE user_id = ? AND friend_id = ?
				UNION
				SELECT 1 FROM friend_relations WHERE user_id = ? AND friend_id = ?
			) as friend_check
		`, userID, friendID, friendID, userID).Scan(&count).Error
	})

	return count > 0, err
}

// AddFriend 添加好友
func (s *FriendService) AddFriend(userID, friendID int64) error {
	// 不能添加自己为好友
	if userID == friendID {
		return errors.New("cannot add yourself as friend")
	}

	// 检查用户是否存在（使用超时控制）
	var user, friend models.User
	err := database.QueryWithTimeout(3*time.Second, func(db *gorm.DB) error {
		if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		return db.Where("id = ?", friendID).First(&friend).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user or friend not found")
		}
		return err
	}

	// 检查是否已经是好友（使用优化的查询）
	exists, err := s.checkFriendshipExists(userID, friendID)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("already friends")
	}

	// 创建双向好友关系（使用超时控制和事务）
	err = database.QueryWithTimeout(5*time.Second, func(db *gorm.DB) error {
		return db.Transaction(func(tx *gorm.DB) error {
			// 创建第一个方向的关系
			if err := tx.Create(&models.FriendRelation{
				UserID:    userID,
				FriendID:  friendID,
				CreatedAt: time.Now(),
			}).Error; err != nil {
				return err
			}

			// 创建另一个方向的关系
			if err := tx.Create(&models.FriendRelation{
				UserID:    friendID,
				FriendID:  userID,
				CreatedAt: time.Now(),
			}).Error; err != nil {
				return err
			}

			return nil
		})
	})

	if err != nil {
		return err
	}

	// 创建互相的会话
	s.createConversation(userID, friendID, 1) // 1-单聊
	s.createConversation(friendID, userID, 1)

	return nil
}

// RemoveFriend 删除好友
func (s *FriendService) RemoveFriend(userID, friendID int64) error {
	log := logger.GetLogger()

	// 使用超时控制和事务删除双向好友关系
	err := database.QueryWithTimeout(10*time.Second, func(db *gorm.DB) error {
		return db.Transaction(func(tx *gorm.DB) error {
			// 删除双向好友关系
			if err := tx.Where("user_id = ? AND friend_id = ?", userID, friendID).Delete(&models.FriendRelation{}).Error; err != nil {
				return err
			}
			if err := tx.Where("user_id = ? AND friend_id = ?", friendID, userID).Delete(&models.FriendRelation{}).Error; err != nil {
				return err
			}

			// 删除相关的消息
			if err := tx.Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
				userID, friendID, friendID, userID).Delete(&models.Message{}).Error; err != nil {
				log.Warnf("Failed to delete messages for users %d and %d: %v", userID, friendID, err)
			}

			// 删除相关的会话
			if err := tx.Where("user_id = ? AND target_id = ? AND type = 1", userID, friendID).Delete(&models.Conversation{}).Error; err != nil {
				log.Warnf("Failed to delete conversation for user %d and target %d: %v", userID, friendID, err)
			}
			if err := tx.Where("user_id = ? AND target_id = ? AND type = 1", friendID, userID).Delete(&models.Conversation{}).Error; err != nil {
				log.Warnf("Failed to delete conversation for user %d and target %d: %v", friendID, userID, err)
			}

			return nil
		})
	})

	if err != nil {
		return err
	}

	log.Infof("Successfully removed friend relationship and cleaned up data for users %d and %d", userID, friendID)
	return nil
}

// GetFriends 获取好友列表
func (s *FriendService) GetFriends(userID int64) ([]FriendInfo, error) {
	var friends []FriendInfo

	// 查询好友关系，获取好友信息
	rows, err := s.db.Raw(`
		SELECT u.id, u.phone, u.nickname, u.avatar, u.gender, u.signature
		FROM friend_relations fr
		JOIN users u ON fr.friend_id = u.id
		WHERE fr.user_id = ?
		ORDER BY fr.created_at DESC
	`, userID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var friend FriendInfo
		if err := rows.Scan(&friend.ID, &friend.Phone, &friend.Nickname, &friend.Avatar, &friend.Gender, &friend.Signature); err != nil {
			return nil, err
		}
		friends = append(friends, friend)
	}

	return friends, nil
}

// GetFriendIDs 获取好友ID列表
func (s *FriendService) GetFriendIDs(userID int64) ([]int64, error) {
	var friendIDs []int64

	rows, err := s.db.Raw(`
		SELECT fr.friend_id
		FROM friend_relations fr
		WHERE fr.user_id = ?
	`, userID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var friendID int64
		if err := rows.Scan(&friendID); err != nil {
			return nil, err
		}
		friendIDs = append(friendIDs, friendID)
	}

	return friendIDs, nil
}

// SearchUsers 搜索用户
func (s *FriendService) SearchUsers(keyword string, currentUserID int64, limit int) ([]FriendInfo, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	var users []FriendInfo

	rows, err := s.db.Raw(`
		SELECT id, phone, nickname, avatar
		FROM users
		WHERE (phone LIKE ? OR nickname LIKE ?)
		AND id != ?
		ORDER BY nickname
		LIMIT ?
	`, "%"+keyword+"%", "%"+keyword+"%", currentUserID, limit).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var user FriendInfo
		if err := rows.Scan(&user.ID, &user.Phone, &user.Nickname, &user.Avatar); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

// IsFriend 检查是否是好友（使用优化查询）
func (s *FriendService) IsFriend(userID, friendID int64) bool {
	exists, err := s.checkFriendshipExists(userID, friendID)
	if err != nil {
		logger.GetLogger().Errorf("Failed to check friendship: %v", err)
		return false
	}
	return exists
}

// createConversation 创建会话
func (s *FriendService) createConversation(userID, targetID int64, convType int) {
	conversation := &models.Conversation{
		UserID:   userID,
		Type:     convType,
		TargetID: targetID,
		UnreadCount: 0,
		UpdatedAt: time.Now(),
	}

	// 使用FirstOrCreate避免重复创建
	s.db.Where(models.Conversation{
		UserID:   userID,
		Type:     convType,
		TargetID: targetID,
	}).FirstOrCreate(conversation)
}
