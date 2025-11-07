package services

import (
	"time"

	"gorm.io/gorm"

	"gochat/internal/database"
	"gochat/internal/models"
)

type GroupService struct {
	db *gorm.DB
}

func NewGroupService() *GroupService {
	return &GroupService{
		db: database.GetDB(),
	}
}

// NewGroupServiceWithDB 创建群组服务（支持依赖注入）
func NewGroupServiceWithDB(db *gorm.DB) *GroupService {
	return &GroupService{
		db: db,
	}
}

// 获取群成员列表
func (s *GroupService) GetGroupMembers(groupID int64) ([]models.GroupMember, error) {
	var members []models.GroupMember
	err := s.db.Where("group_id = ?", groupID).Find(&members).Error
	return members, err
}

// 检查用户是否在群中
func (s *GroupService) IsUserInGroup(userID, groupID int64) (bool, error) {
	var count int64
	err := s.db.Model(&models.GroupMember{}).
		Where("user_id = ? AND group_id = ?", userID, groupID).
		Count(&count).Error
	return count > 0, err
}

// 创建群组
func (s *GroupService) CreateGroup(group *models.Group) error {
	return s.db.Create(group).Error
}

// 添加群成员
func (s *GroupService) AddGroupMember(groupID, userID int64) error {
	member := &models.GroupMember{
		GroupID:  groupID,
		UserID:   userID,
		JoinedAt: time.Now(),
	}
	return s.db.Create(member).Error
}

// 移除群成员
func (s *GroupService) RemoveGroupMember(groupID, userID int64) error {
	return s.db.Where("group_id = ? AND user_id = ?", groupID, userID).
		Delete(&models.GroupMember{}).Error
}

// 获取群组信息
func (s *GroupService) GetGroup(groupID int64) (*models.Group, error) {
	var group models.Group
	err := s.db.First(&group, groupID).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// 获取用户参与的群组
func (s *GroupService) GetUserGroups(userID int64) ([]models.Group, error) {
	var groups []models.Group
	err := s.db.Table("groups").
		Joins("JOIN group_members ON groups.id = group_members.group_id").
		Where("group_members.user_id = ?", userID).
		Find(&groups).Error
	return groups, err
}

// CreateGroupWithMembers 创建群组并添加初始成员
func (s *GroupService) CreateGroupWithMembers(ownerID int64, groupName string, memberIDs []int64) (*models.Group, error) {
	// 开启事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 创建群组
	group := &models.Group{
		Name:        groupName,
		OwnerID:     ownerID,
		MemberCount: len(memberIDs) + 1, // 包含群主
	}
	if err := tx.Create(group).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 添加群主
	ownerMember := &models.GroupMember{
		GroupID:  group.ID,
		UserID:   ownerID,
		JoinedAt: time.Now(),
	}
	if err := tx.Create(ownerMember).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 添加其他成员
	for _, memberID := range memberIDs {
		// 避免重复添加群主
		if memberID == ownerID {
			continue
		}
		member := &models.GroupMember{
			GroupID:  group.ID,
			UserID:   memberID,
			JoinedAt: time.Now(),
		}
		if err := tx.Create(member).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return group, nil
}

// GroupMemberInfo 群成员详细信息
type GroupMemberInfo struct {
	ID       int64  `json:"id"`
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	JoinedAt string `json:"joined_at"`
	IsOwner  bool   `json:"is_owner"`
}

// GetGroupMembersWithUserInfo 获取群成员列表（含用户信息）
func (s *GroupService) GetGroupMembersWithUserInfo(groupID int64) ([]GroupMemberInfo, error) {
	var members []GroupMemberInfo
	err := s.db.Raw(`
		SELECT
			gm.id,
			gm.user_id,
			u.nickname as username,
			u.nickname,
			u.avatar,
			DATE_FORMAT(gm.joined_at, '%Y-%m-%d %H:%i:%s') as joined_at,
			CASE WHEN g.owner_id = gm.user_id THEN 1 ELSE 0 END as is_owner
		FROM group_members gm
		LEFT JOIN users u ON gm.user_id = u.id
		LEFT JOIN `+"`groups`"+` g ON gm.group_id = g.id
		WHERE gm.group_id = ?
		ORDER BY is_owner DESC, gm.joined_at ASC
	`, groupID).Scan(&members).Error
	return members, err
}

// AddGroupMembers 批量添加群成员
func (s *GroupService) AddGroupMembers(groupID int64, userIDs []int64) error {
	// 开启事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	addedCount := 0
	// 添加成员
	for _, userID := range userIDs {
		// 检查成员是否已存在
		var exists bool
		tx.Raw("SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?)", groupID, userID).Scan(&exists)
		if exists {
			// 跳过已存在的成员
			continue
		}

		member := &models.GroupMember{
			GroupID:  groupID,
			UserID:   userID,
			JoinedAt: time.Now(),
		}
		if err := tx.Create(member).Error; err != nil {
			tx.Rollback()
			return err
		}
		addedCount++
	}

	// 更新群成员数量（只增加实际添加的成员数量）
	if addedCount > 0 {
		if err := tx.Model(&models.Group{}).Where("id = ?", groupID).
			Update("member_count", gorm.Expr("member_count + ?", addedCount)).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	// 提交事务
	return tx.Commit().Error
}