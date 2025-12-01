package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type UploadHandler struct {
	config      *config.Config
	fileService *services.FileService
}

func NewUploadHandler(cfg *config.Config) *UploadHandler {
	return &UploadHandler{
		config:      cfg,
		fileService: services.NewFileService(),
	}
}

// UploadImage 上传聊天图片（使用文件去重系统）
func (h *UploadHandler) UploadImage(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	// 获取上传的文件
	fileHeader, err := c.FormFile("image")
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
	result, err := h.fileService.UploadFile(file, fileHeader, userID.(int64), "chat_image", "uploads/images")
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, fmt.Sprintf("Failed to upload file: %v", err)))
		return
	}

	// 提取文件名（用于兼容前端）
	filename := filepath.Base(result.URL)

	// 返回文件URL和去重信息
	response := gin.H{
		"image_url":    "/" + result.URL,
		"filename":     filename,
		"message":      "Image uploaded successfully",
		"deduplicated": result.IsDedup,
	}

	if result.IsDedup {
		response["message"] = "Image uploaded successfully (deduplicated)"
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(response))
}

// UploadVoice 上传语音文件（使用文件去重系统）
func (h *UploadHandler) UploadVoice(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	// 获取上传的文件
	fileHeader, err := c.FormFile("voice")
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "No voice file uploaded"))
		return
	}

	// 检查文件大小 (限制为 2MB)
	if fileHeader.Size > 2*1024*1024 {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Voice file size too large, maximum 2MB"))
		return
	}

	// 检查文件类型
	allowedTypes := []string{".webm", ".mp4", ".m4a", ".mp3", ".ogg", ".wav", ".aac"}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	isAllowed := false
	for _, allowedType := range allowedTypes {
		if ext == allowedType {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid file type, only webm, mp4, m4a, mp3, ogg, wav, aac are allowed"))
		return
	}

	// 打开文件
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to open uploaded file"))
		return
	}
	defer file.Close()

	// 验证音频文件（MIME类型 + 扩展名匹配）
	if err := utils.ValidateAudioFile(file, fileHeader.Filename, ext); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	// 获取前端传入的时长（秒）
	durationStr := c.PostForm("duration")
	var duration float64
	if durationStr != "" {
		if d, err := strconv.ParseFloat(durationStr, 64); err == nil {
			duration = d
		}
	}

	// 使用FileService上传文件（自动去重）
	result, err := h.fileService.UploadFile(file, fileHeader, userID.(int64), "chat_voice", "uploads/voices")
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, fmt.Sprintf("Failed to upload voice file: %v", err)))
		return
	}

	// 提取文件名（用于兼容前端）
	filename := filepath.Base(result.URL)

	// 返回文件URL和去重信息
	response := gin.H{
		"voice_url":    "/" + result.URL,
		"filename":     filename,
		"duration":     duration,
		"message":      "Voice uploaded successfully",
		"deduplicated": result.IsDedup,
	}

	if result.IsDedup {
		response["message"] = "Voice uploaded successfully (deduplicated)"
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(response))
}
