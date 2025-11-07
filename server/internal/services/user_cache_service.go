package services

import (
	"time"

	"gorm.io/gorm"

	"gochat/internal/cache"
	"gochat/internal/database"
	"gochat/internal/models"
)

// UserCacheService 用户缓存服务，提供缓存优先的用户信息查询
type UserCacheService struct {
	userCache *cache.UserCache
}

// NewUserCacheService 创建新的用户缓存服务
func NewUserCacheService() *UserCacheService {
	return &UserCacheService{
		userCache: cache.GetUserCache(),
	}
}

// GetUser 获取用户信息（缓存优先）
func (s *UserCacheService) GetUser(userID int64) (*models.User, error) {
	// 1. 尝试从缓存获取
	user, err := s.userCache.GetUser(userID)
	if err == nil && user != nil {
		return user, nil
	}

	// 2. 缓存未命中，从数据库查询（使用3秒超时）
	var dbUser models.User
	err = database.QueryWithTimeout(3*time.Second, func(db *gorm.DB) error {
		return db.Where("id = ?", userID).First(&dbUser).Error
	})
	if err != nil {
		return nil, err
	}

	// 3. 将查询结果写入缓存
	_ = s.userCache.SetUser(&dbUser, 0) // 忽略缓存写入错误

	return &dbUser, nil
}

// GetUsers 批量获取用户信息（缓存优先）
func (s *UserCacheService) GetUsers(userIDs []int64) (map[int64]*models.User, error) {
	if len(userIDs) == 0 {
		return make(map[int64]*models.User), nil
	}

	// 1. 尝试从缓存批量获取
	cached, missed, err := s.userCache.GetUsers(userIDs)
	if err != nil {
		// 缓存错误，直接查数据库
		missed = userIDs
		cached = make(map[int64]*models.User)
	}

	// 2. 查询缓存未命中的用户（使用5秒超时）
	if len(missed) > 0 {
		var dbUsers []models.User
		err = database.QueryWithTimeout(5*time.Second, func(db *gorm.DB) error {
			return db.Where("id IN ?", missed).Find(&dbUsers).Error
		})
		if err != nil {
			return nil, err
		}

		// 3. 将数据库查询结果添加到结果集并缓存
		var usersToCache []*models.User
		for i := range dbUsers {
			user := &dbUsers[i]
			cached[user.ID] = user
			usersToCache = append(usersToCache, user)
		}

		// 4. 批量写入缓存
		_ = s.userCache.SetUsers(usersToCache, 0) // 忽略缓存写入错误
	}

	return cached, nil
}

// InvalidateUser 使用户缓存失效
func (s *UserCacheService) InvalidateUser(userID int64) error {
	return s.userCache.DeleteUser(userID)
}

// 全局用户缓存服务实例
var userCacheServiceInstance *UserCacheService

// GetUserCacheService 获取用户缓存服务实例
func GetUserCacheService() *UserCacheService {
	if userCacheServiceInstance == nil {
		userCacheServiceInstance = NewUserCacheService()
	}
	return userCacheServiceInstance
}