package utils

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetAuthenticatedUser 从上下文中获取已认证的用户ID
func GetAuthenticatedUser(c *gin.Context) (int64, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}

	if id, ok := userID.(int64); ok {
		return id, true
	}
	return 0, false
}

// RequireAuthentication 中间件助手：要求用户认证，失败时直接返回401
func RequireAuthentication(c *gin.Context) (int64, bool) {
	userID, exists := GetAuthenticatedUser(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse(401, "User not authenticated"))
		c.Abort()
		return 0, false
	}
	return userID, true
}

// ParseInt64Param 解析URL路径中的int64参数
func ParseInt64Param(c *gin.Context, paramName string) (int64, error) {
	paramStr := c.Param(paramName)
	return strconv.ParseInt(paramStr, 10, 64)
}

// ParseInt64Query 解析查询参数中的int64值
func ParseInt64Query(c *gin.Context, queryName string) (int64, error) {
	queryStr := c.Query(queryName)
	if queryStr == "" {
		return 0, nil // 空查询参数返回0而不是错误
	}
	return strconv.ParseInt(queryStr, 10, 64)
}

// ParseIntQuery 解析查询参数中的int值，带默认值
func ParseIntQuery(c *gin.Context, queryName string, defaultValue int) int {
	queryStr := c.Query(queryName)
	if queryStr == "" {
		return defaultValue
	}

	if value, err := strconv.Atoi(queryStr); err == nil {
		return value
	}
	return defaultValue
}

// ValidateAndBindJSON 验证并绑定JSON请求体，失败时自动返回400错误
func ValidateAndBindJSON(c *gin.Context, obj interface{}) bool {
	if err := c.ShouldBindJSON(obj); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse(400, "Invalid request data"))
		return false
	}
	return true
}

// ValidateRequiredQuery 验证必需的查询参数，缺失时自动返回400错误
func ValidateRequiredQuery(c *gin.Context, queryName, fieldName string) (string, bool) {
	value := c.Query(queryName)
	if value == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse(400, fieldName+" is required"))
		c.Abort()
		return "", false
	}
	return value, true
}

// HandleParseError 处理参数解析错误，统一返回400响应
func HandleParseError(c *gin.Context, paramName string) {
	c.JSON(http.StatusBadRequest, ErrorResponse(400, "Invalid "+paramName))
}

// HandleInternalError 处理内部服务器错误，统一返回500响应
func HandleInternalError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, ErrorResponse(500, err.Error()))
}

// HandleNotFoundError 处理资源未找到错误，统一返回404响应
func HandleNotFoundError(c *gin.Context, resourceName string) {
	c.JSON(http.StatusNotFound, ErrorResponse(404, resourceName+" not found"))
}

// HandleBadRequestError 处理请求错误，统一返回400响应
func HandleBadRequestError(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, ErrorResponse(400, message))
}