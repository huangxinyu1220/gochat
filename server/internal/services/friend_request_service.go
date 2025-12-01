package services

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gochat/internal/database"
	"gochat/internal/logger"
	"gochat/internal/models"
	"gochat/internal/notification"
)

// FriendRequestService 好友申请服务
type FriendRequestService struct {
	db            *gorm.DB
	friendService *FriendService
	notifier      *notification.FriendRequestNotifier
}

// NewFriendRequestService 创建好友申请服务
func NewFriendRequestService() *FriendRequestService {
	return &FriendRequestService{
		db:            database.GetDB(),
		friendService: NewFriendService(),
		notifier:      notification.NewFriendRequestNotifier(),
	}
}

// FriendRequestInfo 好友申请信息（响应结构）
type FriendRequestInfo struct {
	ID        int64      `json:"id"`
	FromUser  *UserBrief `json:"from_user,omitempty"`
	ToUser    *UserBrief `json:"to_user,omitempty"`
	Message   string     `json:"message"`
	Status    int        `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// UserBrief 用户简要信息（使用notification包中的定义）
type UserBrief = notification.UserBrief

// SendRequest 发送好友申请
func (s *FriendRequestService) SendRequest(fromUserID, toUserID int64, message string) (*models.FriendRequest, error) {
	log := logger.GetLogger()

	// 不能发送申请给自己
	if fromUserID == toUserID {
		return nil, errors.New("cannot send friend request to yourself")
	}

	// 检查目标用户是否存在
	var toUser models.User
	if err := s.db.Where("id = ?", toUserID).First(&toUser).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	// 检查是否已经是好友
	if s.friendService.IsFriend(fromUserID, toUserID) {
		return nil, errors.New("already friends")
	}

	// 检查是否有待处理的申请（自己发出的）
	hasPending, err := s.HasPendingRequest(fromUserID, toUserID)
	if err != nil {
		return nil, err
	}
	if hasPending {
		return nil, errors.New("pending request already exists")
	}

	// 检查对方是否已经向自己发送了申请
	reverseHasPending, _ := s.HasPendingRequest(toUserID, fromUserID)
	if reverseHasPending {
		return nil, errors.New("the user has already sent you a friend request")
	}

	// 创建好友申请
	request := &models.FriendRequest{
		FromUserID: fromUserID,
		ToUserID:   toUserID,
		Message:    message,
		Status:     models.FriendRequestStatusPending,
	}

	if err := s.db.Create(request).Error; err != nil {
		log.Errorf("Failed to create friend request: %v", err)
		return nil, err
	}

	// 获取发送者信息并发送WebSocket通知
	var fromUser models.User
	if err := s.db.Select("id, nickname, avatar, phone").Where("id = ?", fromUserID).First(&fromUser).Error; err == nil {
		fromUserBrief := &UserBrief{
			ID:       fromUser.ID,
			Nickname: fromUser.Nickname,
			Avatar:   fromUser.Avatar,
			Phone:    maskPhone(fromUser.Phone),
		}
		s.notifier.NotifyNewFriendRequest(request, fromUserBrief)
	}

	log.Infof("Friend request sent from user %d to user %d", fromUserID, toUserID)
	return request, nil
}

// HasPendingRequest 检查是否有待处理的申请
func (s *FriendRequestService) HasPendingRequest(fromUserID, toUserID int64) (bool, error) {
	var count int64
	expireTime := time.Now().AddDate(0, 0, -models.FriendRequestExpireDays)

	err := s.db.Model(&models.FriendRequest{}).
		Where("from_user_id = ? AND to_user_id = ? AND status = ? AND created_at > ?",
			fromUserID, toUserID, models.FriendRequestStatusPending, expireTime).
		Count(&count).Error

	return count > 0, err
}

// GetReceivedRequests 获取收到的好友申请
func (s *FriendRequestService) GetReceivedRequests(userID int64, status *int, page, pageSize int) ([]FriendRequestInfo, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	var requests []models.FriendRequest
	var total int64

	query := s.db.Model(&models.FriendRequest{}).Where("to_user_id = ?", userID)

	// 如果指定了状态，按状态筛选；否则只显示待处理的（未过期的）
	if status != nil {
		query = query.Where("status = ?", *status)
	} else {
		// 默认只显示待处理且未过期的
		expireTime := time.Now().AddDate(0, 0, -models.FriendRequestExpireDays)
		query = query.Where("status = ? AND created_at > ?", models.FriendRequestStatusPending, expireTime)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&requests).Error; err != nil {
		return nil, 0, err
	}

	// 获取发送者用户信息
	result := make([]FriendRequestInfo, 0, len(requests))
	for _, req := range requests {
		var fromUser models.User
		s.db.Select("id, nickname, avatar, phone").Where("id = ?", req.FromUserID).First(&fromUser)

		info := FriendRequestInfo{
			ID: req.ID,
			FromUser: &UserBrief{
				ID:       fromUser.ID,
				Nickname: fromUser.Nickname,
				Avatar:   fromUser.Avatar,
				Phone:    maskPhone(fromUser.Phone),
			},
			Message:   req.Message,
			Status:    req.Status,
			CreatedAt: req.CreatedAt,
			UpdatedAt: req.UpdatedAt,
		}

		// 检查是否已过期
		if req.IsExpired() {
			info.Status = models.FriendRequestStatusExpired
		}

		result = append(result, info)
	}

	return result, total, nil
}

// GetSentRequests 获取发出的好友申请
func (s *FriendRequestService) GetSentRequests(userID int64, status *int, page, pageSize int) ([]FriendRequestInfo, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	var requests []models.FriendRequest
	var total int64

	query := s.db.Model(&models.FriendRequest{}).Where("from_user_id = ?", userID)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&requests).Error; err != nil {
		return nil, 0, err
	}

	// 获取接收者用户信息
	result := make([]FriendRequestInfo, 0, len(requests))
	for _, req := range requests {
		var toUser models.User
		s.db.Select("id, nickname, avatar, phone").Where("id = ?", req.ToUserID).First(&toUser)

		info := FriendRequestInfo{
			ID: req.ID,
			ToUser: &UserBrief{
				ID:       toUser.ID,
				Nickname: toUser.Nickname,
				Avatar:   toUser.Avatar,
				Phone:    maskPhone(toUser.Phone),
			},
			Message:   req.Message,
			Status:    req.Status,
			CreatedAt: req.CreatedAt,
			UpdatedAt: req.UpdatedAt,
		}

		// 检查是否已过期
		if req.IsExpired() {
			info.Status = models.FriendRequestStatusExpired
		}

		result = append(result, info)
	}

	return result, total, nil
}

// AcceptRequest 同意好友申请
func (s *FriendRequestService) AcceptRequest(requestID, userID int64) error {
	log := logger.GetLogger()

	// 查找申请
	var request models.FriendRequest
	if err := s.db.Where("id = ? AND to_user_id = ? AND status = ?",
		requestID, userID, models.FriendRequestStatusPending).First(&request).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("request not found or already processed")
		}
		return err
	}

	// 检查是否已过期
	if request.IsExpired() {
		// 更新状态为已过期
		s.db.Model(&request).Update("status", models.FriendRequestStatusExpired)
		return errors.New("request has expired")
	}

	// 使用事务更新申请状态并创建好友关系
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 更新申请状态
		if err := tx.Model(&request).Update("status", models.FriendRequestStatusAccepted).Error; err != nil {
			return err
		}

		// 创建双向好友关系
		if err := s.addFriendWithTx(tx, request.FromUserID, request.ToUserID); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		log.Errorf("Failed to accept friend request %d: %v", requestID, err)
		return err
	}

	// 重新加载request以获取更新后的时间
	s.db.First(&request, requestID)

	// 获取接受者信息并发送WebSocket通知给申请发送者
	var acceptUser models.User
	if err := s.db.Select("id, nickname, avatar, phone").Where("id = ?", userID).First(&acceptUser).Error; err == nil {
		friendBrief := &UserBrief{
			ID:       acceptUser.ID,
			Nickname: acceptUser.Nickname,
			Avatar:   acceptUser.Avatar,
			Phone:    maskPhone(acceptUser.Phone),
		}
		s.notifier.NotifyFriendRequestAccepted(&request, friendBrief)
	}

	log.Infof("Friend request %d accepted, users %d and %d are now friends", requestID, request.FromUserID, request.ToUserID)
	return nil
}

// RejectRequest 拒绝好友申请
func (s *FriendRequestService) RejectRequest(requestID, userID int64) error {
	log := logger.GetLogger()

	// 先查询获取申请信息
	var request models.FriendRequest
	if err := s.db.Where("id = ? AND to_user_id = ? AND status = ?",
		requestID, userID, models.FriendRequestStatusPending).First(&request).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("request not found or already processed")
		}
		return err
	}

	// 更新状态
	if err := s.db.Model(&request).Update("status", models.FriendRequestStatusRejected).Error; err != nil {
		return err
	}

	// 重新加载以获取更新后的时间
	s.db.First(&request, requestID)

	// 发送WebSocket通知给申请发送者
	s.notifier.NotifyFriendRequestRejected(&request)

	log.Infof("Friend request %d rejected by user %d", requestID, userID)
	return nil
}

// CancelRequest 取消好友申请（发送方取消）
func (s *FriendRequestService) CancelRequest(requestID, userID int64) error {
	log := logger.GetLogger()

	// 软删除申请
	result := s.db.Where("id = ? AND from_user_id = ? AND status = ?",
		requestID, userID, models.FriendRequestStatusPending).
		Delete(&models.FriendRequest{})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("request not found or already processed")
	}

	log.Infof("Friend request %d canceled by user %d", requestID, userID)
	return nil
}

// GetPendingCount 获取待处理的申请数量
func (s *FriendRequestService) GetPendingCount(userID int64) (int64, error) {
	var count int64
	expireTime := time.Now().AddDate(0, 0, -models.FriendRequestExpireDays)

	err := s.db.Model(&models.FriendRequest{}).
		Where("to_user_id = ? AND status = ? AND created_at > ?",
			userID, models.FriendRequestStatusPending, expireTime).
		Count(&count).Error

	return count, err
}

// GetRequestByID 根据ID获取申请详情
func (s *FriendRequestService) GetRequestByID(requestID int64) (*models.FriendRequest, error) {
	var request models.FriendRequest
	if err := s.db.Where("id = ?", requestID).First(&request).Error; err != nil {
		return nil, err
	}
	return &request, nil
}

// addFriendWithTx 在事务中添加好友
func (s *FriendRequestService) addFriendWithTx(tx *gorm.DB, userID, friendID int64) error {
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

	// 创建互相的会话
	s.createConversationWithTx(tx, userID, friendID, models.ConversationTypePrivate)
	s.createConversationWithTx(tx, friendID, userID, models.ConversationTypePrivate)

	return nil
}

// createConversationWithTx 在事务中创建会话
func (s *FriendRequestService) createConversationWithTx(tx *gorm.DB, userID, targetID int64, convType int) {
	conversation := &models.Conversation{
		UserID:      userID,
		Type:        convType,
		TargetID:    targetID,
		UnreadCount: 0,
		UpdatedAt:   time.Now(),
	}

	// 使用FirstOrCreate避免重复创建
	tx.Where(models.Conversation{
		UserID:   userID,
		Type:     convType,
		TargetID: targetID,
	}).FirstOrCreate(conversation)
}

// maskPhone 手机号脱敏
func maskPhone(phone string) string {
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

// RequestStatusInfo 申请状态信息
type RequestStatusInfo struct {
	Status    string `json:"status"`     // "none", "sent", "received"
	RequestID int64  `json:"request_id"` // 申请ID（如果有的话）
}

// GetRequestStatusBatch 批量获取当前用户与目标用户之间的申请状态
// 返回 map[targetUserID]RequestStatusInfo
func (s *FriendRequestService) GetRequestStatusBatch(currentUserID int64, targetUserIDs []int64) (map[int64]RequestStatusInfo, error) {
	result := make(map[int64]RequestStatusInfo)

	if len(targetUserIDs) == 0 {
		return result, nil
	}

	// 初始化所有目标用户的状态为 "none"
	for _, id := range targetUserIDs {
		result[id] = RequestStatusInfo{Status: "none", RequestID: 0}
	}

	expireTime := time.Now().AddDate(0, 0, -models.FriendRequestExpireDays)

	// 查询当前用户发出的待处理申请
	var sentRequests []models.FriendRequest
	if err := s.db.Where("from_user_id = ? AND to_user_id IN ? AND status = ? AND created_at > ?",
		currentUserID, targetUserIDs, models.FriendRequestStatusPending, expireTime).
		Find(&sentRequests).Error; err != nil {
		return nil, err
	}

	for _, req := range sentRequests {
		result[req.ToUserID] = RequestStatusInfo{Status: "sent", RequestID: req.ID}
	}

	// 查询当前用户收到的待处理申请
	var receivedRequests []models.FriendRequest
	if err := s.db.Where("to_user_id = ? AND from_user_id IN ? AND status = ? AND created_at > ?",
		currentUserID, targetUserIDs, models.FriendRequestStatusPending, expireTime).
		Find(&receivedRequests).Error; err != nil {
		return nil, err
	}

	for _, req := range receivedRequests {
		result[req.FromUserID] = RequestStatusInfo{Status: "received", RequestID: req.ID}
	}

	return result, nil
}
