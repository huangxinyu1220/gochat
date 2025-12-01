package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gochat/internal/models"
)

// UserCache 用户信息缓存服务
type UserCache struct{}

// NewUserCache 创建新的用户缓存服务
func NewUserCache() *UserCache {
	return &UserCache{}
}

// GetUser 从缓存获取用户信息，如果缓存不存在则返回 nil
func (uc *UserCache) GetUser(userID int64) (*models.User, error) {
	ctx := context.Background()
	key := fmt.Sprintf("user:profile:%d", userID)

	// 从Redis获取缓存
	result := GetRedisClient().Get(ctx, key)
	if result.Err() != nil {
		return nil, result.Err()
	}

	// 反序列化用户数据
	var user models.User
	err := json.Unmarshal([]byte(result.Val()), &user)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

// SetUser 设置用户信息缓存
func (uc *UserCache) SetUser(user *models.User, expiration time.Duration) error {
	if user == nil || user.ID == 0 {
		return fmt.Errorf("invalid user data")
	}

	ctx := context.Background()
	key := fmt.Sprintf("user:profile:%d", user.ID)

	// 序列化用户数据
	userData, err := json.Marshal(user)
	if err != nil {
		return err
	}

	// 存储到Redis，默认缓存5分钟
	if expiration == 0 {
		expiration = 5 * time.Minute
	}

	return GetRedisClient().Set(ctx, key, userData, expiration).Err()
}

// DeleteUser 删除用户信息缓存
func (uc *UserCache) DeleteUser(userID int64) error {
	ctx := context.Background()
	key := fmt.Sprintf("user:profile:%d", userID)
	return GetRedisClient().Del(ctx, key).Err()
}

// GetUsers 批量获取用户信息
func (uc *UserCache) GetUsers(userIDs []int64) (map[int64]*models.User, []int64, error) {
	if len(userIDs) == 0 {
		return make(map[int64]*models.User), []int64{}, nil
	}

	ctx := context.Background()

	// 构建Redis键
	keys := make([]string, len(userIDs))
	for i, userID := range userIDs {
		keys[i] = fmt.Sprintf("user:profile:%d", userID)
	}

	// 批量获取
	results := GetRedisClient().MGet(ctx, keys...)
	if results.Err() != nil {
		return nil, userIDs, results.Err()
	}

	cached := make(map[int64]*models.User)
	var missed []int64

	// 处理结果
	for i, result := range results.Val() {
		userID := userIDs[i]

		if result == nil {
			// 缓存未命中
			missed = append(missed, userID)
		} else {
			// 反序列化用户数据
			var user models.User
			err := json.Unmarshal([]byte(result.(string)), &user)
			if err != nil {
				missed = append(missed, userID)
			} else {
				cached[userID] = &user
			}
		}
	}

	return cached, missed, nil
}

// SetUsers 批量设置用户信息缓存
func (uc *UserCache) SetUsers(users []*models.User, expiration time.Duration) error {
	if len(users) == 0 {
		return nil
	}

	ctx := context.Background()
	pipe := GetRedisClient().Pipeline()

	// 默认缓存5分钟
	if expiration == 0 {
		expiration = 5 * time.Minute
	}

	for _, user := range users {
		if user == nil || user.ID == 0 {
			continue
		}

		key := fmt.Sprintf("user:profile:%d", user.ID)
		userData, err := json.Marshal(user)
		if err != nil {
			continue
		}

		pipe.Set(ctx, key, userData, expiration)
	}

	_, err := pipe.Exec(ctx)
	return err
}

// 全局用户缓存实例
var userCacheInstance *UserCache

// GetUserCache 获取用户缓存实例
func GetUserCache() *UserCache {
	if userCacheInstance == nil {
		userCacheInstance = NewUserCache()
	}
	return userCacheInstance
}