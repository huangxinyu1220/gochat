package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type UserHandler struct {
	userService *services.UserService
	fileService *services.FileService
}

func NewUserHandler(cfg *config.Config) *UserHandler {
	return &UserHandler{
		userService: services.NewUserService(cfg),
		fileService: services.NewFileService(),
	}
}

// GetProfile 获取个人信息
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	profile, err := h.userService.GetProfile(userID.(int64))
	if err != nil {
		c.JSON(http.StatusNotFound, utils.ErrorResponse(404, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(profile))
}

// UpdateProfile 更新个人信息
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	var req services.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid request data"))
		return
	}

	err := h.userService.UpdateProfile(userID.(int64), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Profile updated successfully"))
}

// UploadAvatar 上传头像（使用文件去重系统）
func (h *UserHandler) UploadAvatar(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	// 获取上传的文件
	fileHeader, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "No file uploaded"))
		return
	}

	// 检查文件大小 (限制为 5MB)
	if fileHeader.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "File size too large, maximum 5MB"))
		return
	}

	// 检查文件类型
	allowedTypes := []string{".jpg", ".jpeg", ".png", ".gif", ".webp"}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	isAllowed := false
	for _, allowedType := range allowedTypes {
		if ext == allowedType {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid file type, only jpg, jpeg, png, gif, webp are allowed"))
		return
	}

	// 打开文件
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to open uploaded file"))
		return
	}
	defer file.Close()

	// 验证图片文件（MIME类型 + 扩展名匹配）
	if err := utils.ValidateImageFile(file, fileHeader.Filename, ext); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	// 使用FileService上传文件（自动去重）
	result, err := h.fileService.UploadFile(file, fileHeader, userID.(int64), "avatar", "uploads/avatars")
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, fmt.Sprintf("Failed to upload file: %v", err)))
		return
	}

	// 获取旧头像信息，用于删除旧引用
	user, err := h.userService.GetUserByID(userID.(int64))
	if err == nil && user.Avatar != "" && user.Avatar != "default.png" {
		// 尝试从旧文件系统查找并删除引用
		// 注意：旧文件可能不在新系统中，这是正常的
		h.fileService.DeleteReference(0, userID.(int64), "avatar")
	}

	// 提取文件名（用于兼容前端）
	filename := filepath.Base(result.URL)

	// 更新用户头像
	req := &services.UpdateProfileRequest{
		Avatar: filename,
	}

	err = h.userService.UpdateProfile(userID.(int64), req)
	if err != nil {
		// 如果数据库更新失败，删除文件引用
		h.fileService.DeleteReference(result.FileStorage.ID, userID.(int64), "avatar")
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	// 返回文件URL和去重信息
	response := map[string]interface{}{
		"avatar_url":   "/" + result.URL,
		"message":      "Avatar uploaded successfully",
		"deduplicated": result.IsDedup,
	}

	if result.IsDedup {
		response["message"] = "Avatar uploaded successfully (deduplicated)"
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(response))
}
