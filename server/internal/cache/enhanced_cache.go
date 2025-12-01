package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"

	"gochat/internal/logger"
	"gochat/internal/models"
)

// CacheService 缓存服务
type CacheService struct {
	client *redis.Client
	ctx    context.Context
}

// NewCacheService 创建缓存服务
func NewCacheService(client *redis.Client) *CacheService {
	return &CacheService{
		client: client,
		ctx:    context.Background(),
	}
}

// 缓存键前缀常量
const (
	// 用户缓存
	UserProfilePrefix    = "user:profile:"    // user:profile:123
	UserByPhonePrefix    = "user:phone:"      // user:phone:13800138000
	UserFriendsPrefix    = "user:friends:"    // user:friends:123
	UserOnlinePrefix     = "user:online:"     // user:online:123

	// 消息缓存
	PrivateMessagesPrefix = "msg:private:"    // msg:private:123:456:1:20
	GroupMessagesPrefix   = "msg:group:"      // msg:group:789:1:20
	UnreadCountPrefix     = "unread:count:"   // unread:count:123:456
	LastMessagePrefix     = "last:msg:"       // last:msg:123:456

	// 会话缓存
	ConversationListPrefix = "conv:list:"     // conv:list:123:1:20
	ConversationPrefix     = "conv:item:"     // conv:item:123

	// 群组缓存
	GroupInfoPrefix       = "group:info:"     // group:info:789
	GroupMembersPrefix    = "group:members:"  // group:members:789

	// 文件缓存
	FileInfoPrefix        = "file:info:"      // file:info:123

	// 统计缓存
	OnlineCountPrefix     = "stats:online"    // stats:online
	MessageStatsPrefix    = "stats:msg:"      // stats:msg:daily:20231201
)

// 缓存过期时间常量
const (
	UserProfileTTL       = 30 * time.Minute  // 用户资料缓存30分钟
	UserFriendsTTL       = 15 * time.Minute  // 好友列表缓存15分钟
	MessagesTTL          = 5 * time.Minute   // 消息列表缓存5分钟
	ConversationTTL      = 10 * time.Minute  // 会话列表缓存10分钟
	GroupInfoTTL         = 30 * time.Minute  // 群组信息缓存30分钟
	OnlineStatusTTL      = 1 * time.Minute   // 在线状态缓存1分钟
	FileInfoTTL          = 60 * time.Minute  // 文件信息缓存1小时
	StatsTTL             = 5 * time.Minute   // 统计数据缓存5分钟
	ShortTTL             = 30 * time.Second  // 短期缓存30秒
)

// ========== 用户相关缓存 ==========

// CacheUserProfile 缓存用户资料
func (c *CacheService) CacheUserProfile(userID int64, profile *models.User) error {
	key := UserProfilePrefix + strconv.FormatInt(userID, 10)
	data, err := json.Marshal(profile)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, UserProfileTTL).Err()
}

// GetUserProfile 获取缓存的用户资料
func (c *CacheService) GetUserProfile(userID int64) (*models.User, error) {
	key := UserProfilePrefix + strconv.FormatInt(userID, 10)
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // 缓存未命中
		}
		return nil, err
	}

	var profile models.User
	err = json.Unmarshal([]byte(data), &profile)
	return &profile, err
}

// CacheUserByPhone 缓存通过手机号查找的用户
func (c *CacheService) CacheUserByPhone(phone string, userID int64) error {
	key := UserByPhonePrefix + phone
	return c.client.Set(c.ctx, key, userID, UserProfileTTL).Err()
}

// GetUserByPhone 通过手机号获取用户ID
func (c *CacheService) GetUserByPhone(phone string) (int64, error) {
	key := UserByPhonePrefix + phone
	result, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return 0, nil
		}
		return 0, err
	}
	return strconv.ParseInt(result, 10, 64)
}

// InvalidateUserCache 删除用户相关缓存
func (c *CacheService) InvalidateUserCache(userID int64, phone string) error {
	keys := []string{
		UserProfilePrefix + strconv.FormatInt(userID, 10),
		UserByPhonePrefix + phone,
		UserFriendsPrefix + strconv.FormatInt(userID, 10),
	}
	return c.client.Del(c.ctx, keys...).Err()
}

// ========== 消息相关缓存 ==========

// CachePrivateMessages 缓存单聊消息列表
func (c *CacheService) CachePrivateMessages(userID1, userID2 int64, page, pageSize int, messages interface{}) error {
	key := fmt.Sprintf("%s%d:%d:%d:%d", PrivateMessagesPrefix, userID1, userID2, page, pageSize)
	data, err := json.Marshal(messages)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, MessagesTTL).Err()
}

// GetPrivateMessages 获取缓存的单聊消息列表
func (c *CacheService) GetPrivateMessages(userID1, userID2 int64, page, pageSize int, result interface{}) error {
	key := fmt.Sprintf("%s%d:%d:%d:%d", PrivateMessagesPrefix, userID1, userID2, page, pageSize)
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil // 缓存未命中
		}
		return err
	}
	return json.Unmarshal([]byte(data), result)
}

// CacheGroupMessages 缓存群聊消息列表
func (c *CacheService) CacheGroupMessages(groupID int64, page, pageSize int, messages interface{}) error {
	key := fmt.Sprintf("%s%d:%d:%d", GroupMessagesPrefix, groupID, page, pageSize)
	data, err := json.Marshal(messages)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, MessagesTTL).Err()
}

// GetGroupMessages 获取缓存的群聊消息列表
func (c *CacheService) GetGroupMessages(groupID int64, page, pageSize int, result interface{}) error {
	key := fmt.Sprintf("%s%d:%d:%d", GroupMessagesPrefix, groupID, page, pageSize)
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil
		}
		return err
	}
	return json.Unmarshal([]byte(data), result)
}

// CacheLastMessage 缓存最后一条消息
func (c *CacheService) CacheLastMessage(userID, targetID int64, isGroup bool, message *models.Message) error {
	var key string
	if isGroup {
		key = fmt.Sprintf("%sgroup:%d", LastMessagePrefix, targetID)
	} else {
		// 确保键的一致性
		if userID > targetID {
			userID, targetID = targetID, userID
		}
		key = fmt.Sprintf("%sprivate:%d:%d", LastMessagePrefix, userID, targetID)
	}

	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, MessagesTTL).Err()
}

// GetLastMessage 获取缓存的最后一条消息
func (c *CacheService) GetLastMessage(userID, targetID int64, isGroup bool) (*models.Message, error) {
	var key string
	if isGroup {
		key = fmt.Sprintf("%sgroup:%d", LastMessagePrefix, targetID)
	} else {
		if userID > targetID {
			userID, targetID = targetID, userID
		}
		key = fmt.Sprintf("%sprivate:%d:%d", LastMessagePrefix, userID, targetID)
	}

	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var message models.Message
	err = json.Unmarshal([]byte(data), &message)
	return &message, err
}

// InvalidateMessageCache 删除消息相关缓存
func (c *CacheService) InvalidateMessageCache(userID, targetID int64, isGroup bool) error {
	pattern := ""
	if isGroup {
		pattern = fmt.Sprintf("%s%d:*", GroupMessagesPrefix, targetID)
	} else {
		// 删除双向的私聊消息缓存
		pattern1 := fmt.Sprintf("%s%d:%d:*", PrivateMessagesPrefix, userID, targetID)
		pattern2 := fmt.Sprintf("%s%d:%d:*", PrivateMessagesPrefix, targetID, userID)

		keys1, _ := c.client.Keys(c.ctx, pattern1).Result()
		keys2, _ := c.client.Keys(c.ctx, pattern2).Result()

		allKeys := append(keys1, keys2...)
		if len(allKeys) > 0 {
			c.client.Del(c.ctx, allKeys...)
		}
		return nil
	}

	keys, err := c.client.Keys(c.ctx, pattern).Result()
	if err != nil {
		return err
	}
	if len(keys) > 0 {
		return c.client.Del(c.ctx, keys...).Err()
	}
	return nil
}

// ========== 会话相关缓存 ==========

// CacheConversationList 缓存会话列表
func (c *CacheService) CacheConversationList(userID int64, page, pageSize int, conversations interface{}) error {
	key := fmt.Sprintf("%s%d:%d:%d", ConversationListPrefix, userID, page, pageSize)
	data, err := json.Marshal(conversations)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, ConversationTTL).Err()
}

// GetConversationList 获取缓存的会话列表
func (c *CacheService) GetConversationList(userID int64, page, pageSize int, result interface{}) error {
	key := fmt.Sprintf("%s%d:%d:%d", ConversationListPrefix, userID, page, pageSize)
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil
		}
		return err
	}
	return json.Unmarshal([]byte(data), result)
}

// InvalidateConversationCache 删除会话缓存
func (c *CacheService) InvalidateConversationCache(userID int64) error {
	pattern := fmt.Sprintf("%s%d:*", ConversationListPrefix, userID)
	keys, err := c.client.Keys(c.ctx, pattern).Result()
	if err != nil {
		return err
	}
	if len(keys) > 0 {
		return c.client.Del(c.ctx, keys...).Err()
	}
	return nil
}

// ========== 群组相关缓存 ==========

// CacheGroupInfo 缓存群组信息
func (c *CacheService) CacheGroupInfo(groupID int64, group *models.Group) error {
	key := GroupInfoPrefix + strconv.FormatInt(groupID, 10)
	data, err := json.Marshal(group)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, GroupInfoTTL).Err()
}

// GetGroupInfo 获取缓存的群组信息
func (c *CacheService) GetGroupInfo(groupID int64) (*models.Group, error) {
	key := GroupInfoPrefix + strconv.FormatInt(groupID, 10)
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var group models.Group
	err = json.Unmarshal([]byte(data), &group)
	return &group, err
}

// CacheGroupMembers 缓存群组成员列表
func (c *CacheService) CacheGroupMembers(groupID int64, members interface{}) error {
	key := GroupMembersPrefix + strconv.FormatInt(groupID, 10)
	data, err := json.Marshal(members)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, GroupInfoTTL).Err()
}

// GetGroupMembers 获取缓存的群组成员列表
func (c *CacheService) GetGroupMembers(groupID int64, result interface{}) error {
	key := GroupMembersPrefix + strconv.FormatInt(groupID, 10)
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil
		}
		return err
	}
	return json.Unmarshal([]byte(data), result)
}

// InvalidateGroupCache 删除群组相关缓存
func (c *CacheService) InvalidateGroupCache(groupID int64) error {
	keys := []string{
		GroupInfoPrefix + strconv.FormatInt(groupID, 10),
		GroupMembersPrefix + strconv.FormatInt(groupID, 10),
	}
	return c.client.Del(c.ctx, keys...).Err()
}

// ========== 在线状态缓存 ==========

// SetUserOnline 设置用户在线状态
func (c *CacheService) SetUserOnline(userID int64) error {
	key := UserOnlinePrefix + strconv.FormatInt(userID, 10)
	return c.client.Set(c.ctx, key, time.Now().Unix(), OnlineStatusTTL).Err()
}

// IsUserOnline 检查用户是否在线
func (c *CacheService) IsUserOnline(userID int64) (bool, error) {
	key := UserOnlinePrefix + strconv.FormatInt(userID, 10)
	_, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// SetUserOffline 设置用户离线
func (c *CacheService) SetUserOffline(userID int64) error {
	key := UserOnlinePrefix + strconv.FormatInt(userID, 10)
	return c.client.Del(c.ctx, key).Err()
}

// GetOnlineUsers 获取在线用户列表
func (c *CacheService) GetOnlineUsers() ([]int64, error) {
	pattern := UserOnlinePrefix + "*"
	keys, err := c.client.Keys(c.ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	var userIDs []int64
	for _, key := range keys {
		userIDStr := key[len(UserOnlinePrefix):]
		if userID, err := strconv.ParseInt(userIDStr, 10, 64); err == nil {
			userIDs = append(userIDs, userID)
		}
	}
	return userIDs, nil
}

// GetOnlineCount 获取在线用户数量
func (c *CacheService) GetOnlineCount() (int64, error) {
	// 先尝试从缓存获取
	count, err := c.client.Get(c.ctx, OnlineCountPrefix).Int64()
	if err == nil {
		return count, nil
	}

	// 如果缓存没有，计算并缓存
	pattern := UserOnlinePrefix + "*"
	keys, err := c.client.Keys(c.ctx, pattern).Result()
	if err != nil {
		return 0, err
	}

	count = int64(len(keys))
	// 缓存结果
	c.client.Set(c.ctx, OnlineCountPrefix, count, ShortTTL)
	return count, nil
}

// ========== 统计缓存 ==========

// IncrementMessageStats 增加消息统计
func (c *CacheService) IncrementMessageStats(date string) error {
	key := MessageStatsPrefix + date
	return c.client.Incr(c.ctx, key).Err()
}

// GetMessageStats 获取消息统计
func (c *CacheService) GetMessageStats(date string) (int64, error) {
	key := MessageStatsPrefix + date
	return c.client.Get(c.ctx, key).Int64()
}

// ========== 通用缓存操作 ==========

// Set 通用设置缓存
func (c *CacheService) Set(key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(c.ctx, key, data, ttl).Err()
}

// Get 通用获取缓存
func (c *CacheService) Get(key string, result interface{}) error {
	data, err := c.client.Get(c.ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(data), result)
}

// Delete 删除缓存
func (c *CacheService) Delete(keys ...string) error {
	return c.client.Del(c.ctx, keys...).Err()
}

// DeletePattern 按模式删除缓存
func (c *CacheService) DeletePattern(pattern string) error {
	keys, err := c.client.Keys(c.ctx, pattern).Result()
	if err != nil {
		return err
	}
	if len(keys) > 0 {
		return c.client.Del(c.ctx, keys...).Err()
	}
	return nil
}

// Exists 检查键是否存在
func (c *CacheService) Exists(key string) (bool, error) {
	result, err := c.client.Exists(c.ctx, key).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

// Expire 设置键过期时间
func (c *CacheService) Expire(key string, ttl time.Duration) error {
	return c.client.Expire(c.ctx, key, ttl).Err()
}

// ========== 缓存预热和批量操作 ==========

// WarmupUserCache 预热用户缓存
func (c *CacheService) WarmupUserCache(users []models.User) error {
	pipe := c.client.Pipeline()

	for _, user := range users {
		userKey := UserProfilePrefix + strconv.FormatInt(user.ID, 10)
		phoneKey := UserByPhonePrefix + user.Phone

		userData, _ := json.Marshal(user)
		pipe.Set(c.ctx, userKey, userData, UserProfileTTL)
		pipe.Set(c.ctx, phoneKey, user.ID, UserProfileTTL)
	}

	_, err := pipe.Exec(c.ctx)
	if err != nil {
		logger.GetLogger().Errorf("Failed to warmup user cache: %v", err)
	}
	return err
}

// BatchInvalidate 批量删除缓存
func (c *CacheService) BatchInvalidate(patterns []string) error {
	var allKeys []string

	for _, pattern := range patterns {
		keys, err := c.client.Keys(c.ctx, pattern).Result()
		if err != nil {
			logger.GetLogger().Errorf("Failed to get keys for pattern %s: %v", pattern, err)
			continue
		}
		allKeys = append(allKeys, keys...)
	}

	if len(allKeys) > 0 {
		return c.client.Del(c.ctx, allKeys...).Err()
	}
	return nil
}

// GetCacheStats 获取缓存统计信息
func (c *CacheService) GetCacheStats() (map[string]interface{}, error) {
	// 解析 Redis INFO 命令的结果
	stats := make(map[string]interface{})

	// 获取基本统计信息
	keyspaceInfo := c.client.Info(c.ctx, "keyspace").Val()
	stats["keyspace_info"] = keyspaceInfo

	// 获取内存使用信息
	memoryInfo := c.client.Info(c.ctx, "memory").Val()
	stats["memory_info"] = memoryInfo

	// 获取连接统计
	clientsInfo := c.client.Info(c.ctx, "clients").Val()
	stats["clients_info"] = clientsInfo

	return stats, nil
}