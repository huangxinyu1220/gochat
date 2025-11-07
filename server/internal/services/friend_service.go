package services

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"gochat/internal/database"
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

type FriendInfo struct {
	ID        int64  `json:"id"`
	Phone     string `json:"phone"`
	Nickname  string `json:"nickname"`
	Avatar    string `json:"avatar"`
	Gender    int    `json:"gender"`    // 0-未设置 1-男 2-女
	Signature string `json:"signature"` // 个性签名
}

// AddFriend 添加好友
func (s *FriendService) AddFriend(userID, friendID int64) error {
	// 不能添加自己为好友
	if userID == friendID {
		return errors.New("cannot add yourself as friend")
	}

	// 检查用户是否存在
	var user, friend models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("user not found")
	}
	if err := s.db.Where("id = ?", friendID).First(&friend).Error; err != nil {
		return errors.New("friend not found")
	}

	// 检查是否已经是好友
	var existing models.FriendRelation
	if err := s.db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, friendID, friendID, userID).First(&existing).Error; err == nil {
		return errors.New("already friends")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 创建双向好友关系
	if err := s.db.Create(&models.FriendRelation{
		UserID:   userID,
		FriendID: friendID,
		CreatedAt: time.Now(),
	}).Error; err != nil {
		return err
	}

	if err := s.db.Create(&models.FriendRelation{
		UserID:   friendID,
		FriendID: userID,
		CreatedAt: time.Now(),
	}).Error; err != nil {
		return err
	}

	// 创建互相的会话
	s.createConversation(userID, friendID, 1) // 1-单聊
	s.createConversation(friendID, userID, 1)

	return nil
}

// RemoveFriend 删除好友
func (s *FriendService) RemoveFriend(userID, friendID int64) error {
	// 删除双向好友关系
	if err := s.db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, friendID, friendID, userID).Delete(&models.FriendRelation{}).Error; err != nil {
		return err
	}

	// 删除相关的消息 - 先删除消息，再删除会话
	if err := s.db.Where("(from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
		userID, friendID, friendID, userID).Delete(&models.Message{}).Error; err != nil {
		// 记录日志但不阻止删除好友操作
		fmt.Printf("Warning: Failed to delete messages for users %d and %d: %v\n", userID, friendID, err)
	}

	// 删除相关的会话 - 双向删除
	if err := s.db.Where("(user_id = ? AND target_id = ? AND type = 1) OR (user_id = ? AND target_id = ? AND type = 1)",
		userID, friendID, friendID, userID).Delete(&models.Conversation{}).Error; err != nil {
		// 记录日志但不阻止删除好友操作
		fmt.Printf("Warning: Failed to delete conversations for users %d and %d: %v\n", userID, friendID, err)
	}

	fmt.Printf("Successfully removed friend relationship and cleaned up data for users %d and %d\n", userID, friendID)
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

// IsFriend 检查是否是好友
func (s *FriendService) IsFriend(userID, friendID int64) bool {
	var count int64
	s.db.Model(&models.FriendRelation{}).
		Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
			userID, friendID, friendID, userID).Count(&count)
	return count > 0
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
