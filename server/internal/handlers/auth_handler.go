package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"gochat/internal/config"
	"gochat/internal/services"
	"gochat/internal/utils"
)

type AuthHandler struct {
	userService *services.UserService
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		userService: services.NewUserService(cfg),
	}
}

// Register 用户注册
func (h *AuthHandler) Register(c *gin.Context) {
	var req services.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid request data"))
		return
	}

	response, err := h.userService.Register(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(response))
}

// Login 用户登录
func (h *AuthHandler) Login(c *gin.Context) {
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, "Invalid request data"))
		return
	}

	response, err := h.userService.Login(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.ErrorResponse(400, err.Error()))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse(response))
}

// Logout 用户登出
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.ErrorResponse(401, "User not authenticated"))
		return
	}

	err := h.userService.Logout(userID.(int64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.ErrorResponse(500, "Failed to logout"))
		return
	}

	c.JSON(http.StatusOK, utils.SuccessResponse("Logged out successfully"))
}
