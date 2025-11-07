package services

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gochat/internal/cache"
	"gochat/internal/config"
	"gochat/internal/database"
	"gochat/internal/models"
	"gochat/internal/utils"
)

type UserService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewUserService(cfg *config.Config) *UserService {
	return &UserService{
		db:  database.GetDB(),
		cfg: cfg,
	}
}

// NewUserServiceWithDB 创建用户服务（支持依赖注入）
func NewUserServiceWithDB(db *gorm.DB, cfg *config.Config) *UserService {
	return &UserService{
		db:  db,
		cfg: cfg,
	}
}

type RegisterRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
	Nickname string `json:"nickname" binding:"required"`
}

type RegisterResponse struct {
	UserID   int64  `json:"user_id"`
	Token    string `json:"token"`
	ExpireAt int64  `json:"expire_at"`
}

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	UserID   int64  `json:"user_id"`
	UserInfo *UserInfo `json:"user_info"`
	Token    string `json:"token"`
	ExpireAt int64  `json:"expire_at"`
}

type UserInfo struct {
	ID        int64  `json:"id"`
	Phone     string `json:"phone"`
	Nickname  string `json:"nickname"`
	Avatar    string `json:"avatar"`
	Gender    int    `json:"gender"`    // 0-未设置 1-男 2-女
	Signature string `json:"signature"` // 个性签名
}

// Register 用户注册
func (s *UserService) Register(req *RegisterRequest) (*RegisterResponse, error) {
	// 验证输入
	if !utils.ValidatePhone(req.Phone) {
		return nil, errors.New("invalid phone number")
	}
	if !utils.ValidatePassword(req.Password) {
		return nil, errors.New("password must be 6-20 characters")
	}
	if !utils.ValidateNickname(req.Nickname) {
		return nil, errors.New("nickname must be 2-20 characters")
	}

	// 检查手机号是否已存在（使用3秒超时）
	var existingUser models.User
	checkErr := database.QueryWithTimeout(3*time.Second, func(db *gorm.DB) error {
		return db.Where("phone = ?", req.Phone).First(&existingUser).Error
	})

	if checkErr == nil {
		return nil, errors.New("phone number already exists")
	} else if !errors.Is(checkErr, gorm.ErrRecordNotFound) {
		return nil, checkErr
	}

	// 哈希密码
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// 创建用户（使用5秒超时）
	user := models.User{
		Phone:        req.Phone,
		PasswordHash: hashedPassword,
		Nickname:     req.Nickname,
		Avatar:       "default.png",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := database.QueryWithTimeout(5*time.Second, func(db *gorm.DB) error {
		return db.Create(&user).Error
	}); err != nil {
		return nil, err
	}

	// 生成JWT token
	token, expireAt, err := utils.GenerateToken(user.ID, &s.cfg.JWT)
	if err != nil {
		return nil, err
	}

	// 存储token到Redis
	expireDuration := time.Duration(s.cfg.JWT.ExpireHours) * time.Hour
	if err := cache.StoreToken(user.ID, token, expireDuration); err != nil {
		return nil, err
	}

	// 设置在线状态
	if err := cache.SetOnlineStatus(user.ID, true); err != nil {
		// 不影响注册成功，仅记录警告
	}

	return &RegisterResponse{
		UserID:   user.ID,
		Token:    token,
		ExpireAt: expireAt,
	}, nil
}

// Login 用户登录
func (s *UserService) Login(req *LoginRequest) (*LoginResponse, error) {
	// 验证输入
	if !utils.ValidatePhone(req.Phone) {
		return nil, errors.New("invalid phone number")
	}

	// 查找用户（使用5秒超时）
	var user models.User
	err := database.QueryWithTimeout(5*time.Second, func(db *gorm.DB) error {
		return db.Where("phone = ?", req.Phone).First(&user).Error
	})

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	// 验证密码
	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, errors.New("incorrect password")
	}

	// 生成JWT token
	token, expireAt, err := utils.GenerateToken(user.ID, &s.cfg.JWT)
	if err != nil {
		return nil, err
	}

	// 存储token到Redis
	expireDuration := time.Duration(s.cfg.JWT.ExpireHours) * time.Hour
	if err := cache.StoreToken(user.ID, token, expireDuration); err != nil {
		return nil, err
	}

	// 设置在线状态
	if err := cache.SetOnlineStatus(user.ID, true); err != nil {
		// 不影响登录成功，仅记录警告
	}

	userInfo := &UserInfo{
		ID:        user.ID,
		Phone:     user.Phone,
		Nickname:  user.Nickname,
		Avatar:    user.Avatar,
		Gender:    user.Gender,
		Signature: user.Signature,
	}

	return &LoginResponse{
		UserID:   user.ID,
		UserInfo: userInfo,
		Token:    token,
		ExpireAt: expireAt,
	}, nil
}

// Logout 用户登出
func (s *UserService) Logout(userID int64) error {
	// 删除Redis中的token
	if err := cache.DeleteToken(userID); err != nil {
		return err
	}

	// 设置离线状态
	if err := cache.SetOnlineStatus(userID, false); err != nil {
		return err
	}

	return nil
}

// GetProfile 获取个人信息
func (s *UserService) GetProfile(userID int64) (*UserInfo, error) {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return &UserInfo{
		ID:        user.ID,
		Phone:     user.Phone,
		Nickname:  user.Nickname,
		Avatar:    user.Avatar,
		Gender:    user.Gender,
		Signature: user.Signature,
	}, nil
}

type UpdateProfileRequest struct {
	Nickname  string `json:"nickname"`
	Avatar    string `json:"avatar"`
	Gender    *int   `json:"gender"`    // 使用指针，允许设置为0
	Signature string `json:"signature"`
}

// UpdateProfile 更新个人信息
func (s *UserService) UpdateProfile(userID int64, req *UpdateProfileRequest) error {
	// 验证输入
	if req.Nickname != "" && !utils.ValidateNickname(req.Nickname) {
		return errors.New("nickname must be 2-20 characters")
	}

	// 验证性别值
	if req.Gender != nil && (*req.Gender < 0 || *req.Gender > 2) {
		return errors.New("gender must be 0 (unset), 1 (male), or 2 (female)")
	}

	updates := make(map[string]interface{})
	if req.Nickname != "" {
		updates["nickname"] = req.Nickname
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.Gender != nil {
		updates["gender"] = *req.Gender
	}
	if req.Signature != "" {
		updates["signature"] = req.Signature
	}

	if len(updates) > 0 {
		updates["updated_at"] = time.Now()
		err := s.db.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error
		if err != nil {
			return err
		}

		// 更新成功后，让用户缓存失效
		userCacheService := GetUserCacheService()
		_ = userCacheService.InvalidateUser(userID) // 忽略缓存失效错误

		return nil
	}

	return nil
}

// GetUserByID 根据ID获取用户信息
func (s *UserService) GetUserByID(userID int64) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

