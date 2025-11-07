package services

import (
	"time"

	"gochat/internal/models"
)

// MessageServiceInterface 消息服务接口
type MessageServiceInterface interface {
	SaveMessage(msg *models.Message) (int64, error)
	GetPrivateMessages(userID1, userID2 int64, page, pageSize int) ([]models.Message, int64, error)
	GetGroupMessages(groupID int64, page, pageSize int) ([]models.Message, int64, error)
	GetLastMessage(userID, targetID int64, isGroup bool) (*models.Message, error)
	GetUnreadCount(userID, targetID int64, isGroup bool, lastReadTime time.Time) (int64, error)
	MarkAsRead(userID, messageID int64) error
	GetPrivateMessagesWithUserInfo(userID1, userID2 int64, page, pageSize int) ([]MessageInfo, int64, error)
	GetGroupMessagesWithUserInfo(groupID int64, page, pageSize int) ([]MessageInfo, int64, error)
}

// ConversationServiceInterface 会话服务接口
type ConversationServiceInterface interface {
	GetConversations(userID int64) ([]ConversationInfo, error)
	ClearUnreadCount(userID, conversationID int64) error
	UpdateLastMessage(userID, targetID, messageID int64, content string) error
	IncrementUnreadCount(userID, targetID int64, conversationType int) error
	CreateOrUpdateConversation(userID, targetID int64, conversationType int) (*models.Conversation, error)
	GetConversationByID(conversationID, userID int64) (*models.Conversation, error)
}

// FriendServiceInterface 好友服务接口
type FriendServiceInterface interface {
	AddFriend(userID, friendID int64) error
	RemoveFriend(userID, friendID int64) error
	GetFriends(userID int64) ([]FriendInfo, error)
	GetFriendIDs(userID int64) ([]int64, error)
	IsFriend(userID, friendID int64) bool
	SearchUsers(keyword string, currentUserID int64, limit int) ([]FriendInfo, error)
}

// GroupServiceInterface 群组服务接口
type GroupServiceInterface interface {
	CreateGroup(group *models.Group) error
	GetGroup(groupID int64) (*models.Group, error)
	GetGroupMembers(groupID int64) ([]models.GroupMember, error)
	GetGroupMembersWithUserInfo(groupID int64) ([]GroupMemberInfo, error)
	AddGroupMembers(groupID int64, userIDs []int64) error
	RemoveGroupMember(groupID int64, userID int64) error
	IsUserInGroup(userID, groupID int64) (bool, error)
	GetUserGroups(userID int64) ([]models.Group, error)
}

// UserServiceInterface 用户服务接口
type UserServiceInterface interface {
	Register(req *RegisterRequest) (*RegisterResponse, error)
	Login(req *LoginRequest) (*LoginResponse, error)
	Logout(userID int64) error
	GetProfile(userID int64) (*UserInfo, error)
	UpdateProfile(userID int64, req *UpdateProfileRequest) error
	GetUserByID(userID int64) (*models.User, error)
}