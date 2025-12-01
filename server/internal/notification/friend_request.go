package notification

import (
	"gochat/internal/models"
)

// MessageSender 消息发送函数类型
type MessageSender func(userID int64, message interface{}) bool

// 全局消息发送函数，在应用启动时注入
var messageSender MessageSender

// SetMessageSender 设置消息发送函数
func SetMessageSender(sender MessageSender) {
	messageSender = sender
}

// FriendRequestNotifier 好友申请通知器
type FriendRequestNotifier struct{}

// NewFriendRequestNotifier 创建好友申请通知器
func NewFriendRequestNotifier() *FriendRequestNotifier {
	return &FriendRequestNotifier{}
}

// WSMessage WebSocket消息格式
type WSMessage struct {
	Type   string      `json:"type"`
	Action string      `json:"action"`
	MsgID  string      `json:"msg_id,omitempty"`
	Data   interface{} `json:"data,omitempty"`
}

// UserBrief 用户简要信息
type UserBrief struct {
	ID       int64  `json:"id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Phone    string `json:"phone,omitempty"`
}

// NotifyNewFriendRequest 通知用户收到新的好友申请
func (n *FriendRequestNotifier) NotifyNewFriendRequest(request *models.FriendRequest, fromUser *UserBrief) {
	if messageSender == nil {
		return
	}

	message := WSMessage{
		Type:   "friend_request",
		Action: "new_request",
		Data: map[string]interface{}{
			"request_id": request.ID,
			"from_user":  fromUser,
			"message":    request.Message,
			"created_at": request.CreatedAt.UnixMilli(),
		},
	}

	messageSender(request.ToUserID, message)
}

// NotifyFriendRequestAccepted 通知申请发送者申请已被接受
func (n *FriendRequestNotifier) NotifyFriendRequestAccepted(request *models.FriendRequest, friend *UserBrief) {
	if messageSender == nil {
		return
	}

	message := WSMessage{
		Type:   "friend_request",
		Action: "request_accepted",
		Data: map[string]interface{}{
			"request_id":  request.ID,
			"friend":      friend,
			"accepted_at": request.UpdatedAt.UnixMilli(),
		},
	}

	messageSender(request.FromUserID, message)
}

// NotifyFriendRequestRejected 通知申请发送者申请已被拒绝
func (n *FriendRequestNotifier) NotifyFriendRequestRejected(request *models.FriendRequest) {
	if messageSender == nil {
		return
	}

	message := WSMessage{
		Type:   "friend_request",
		Action: "request_rejected",
		Data: map[string]interface{}{
			"request_id":  request.ID,
			"to_user_id":  request.ToUserID,
			"rejected_at": request.UpdatedAt.UnixMilli(),
		},
	}

	messageSender(request.FromUserID, message)
}

// NotifyPendingRequestCount 通知用户待处理申请数量
func (n *FriendRequestNotifier) NotifyPendingRequestCount(userID int64, count int64) {
	if messageSender == nil {
		return
	}

	message := WSMessage{
		Type:   "friend_request",
		Action: "pending_count",
		Data: map[string]interface{}{
			"count": count,
		},
	}

	messageSender(userID, message)
}
