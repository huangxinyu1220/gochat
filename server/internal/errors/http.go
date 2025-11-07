package errors

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"gochat/internal/logger"
)

// HTTPErrorResponse HTTP错误响应结构
type HTTPErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// HandleError 处理错误并返回HTTP响应
func HandleError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	var appErr *AppError
	var statusCode int
	var response HTTPErrorResponse

	if IsAppError(err) {
		appErr = GetAppError(err)
		statusCode = appErr.HTTPStatusCode()
		response = HTTPErrorResponse{
			Code:    string(appErr.Code),
			Message: appErr.Message,
			Details: appErr.Details,
		}

		// 记录错误（内部错误记录为错误级别，客户端错误记录为警告级别）
		if statusCode >= 500 {
			logger.GetLogger().WithFields(map[string]interface{}{
				"error_code": appErr.Code,
				"cause":      appErr.Cause,
				"path":       c.Request.URL.Path,
				"method":     c.Request.Method,
			}).Errorf("Internal error: %s", appErr.Message)
		} else {
			logger.GetLogger().WithFields(map[string]interface{}{
				"error_code": appErr.Code,
				"path":       c.Request.URL.Path,
				"method":     c.Request.Method,
			}).Warnf("Client error: %s", appErr.Message)
		}
	} else {
		// 未知错误，转换为内部错误
		statusCode = http.StatusInternalServerError
		response = HTTPErrorResponse{
			Code:    string(ErrCodeInternalError),
			Message: "Internal server error",
		}

		// 记录原始错误详情
		logger.GetLogger().WithFields(map[string]interface{}{
			"path":   c.Request.URL.Path,
			"method": c.Request.Method,
		}).Errorf("Unexpected error: %v", err)
	}

	c.JSON(statusCode, response)
}

// AbortWithError 中止请求并处理错误
func AbortWithError(c *gin.Context, err error) {
	HandleError(c, err)
	c.Abort()
}

// 便捷的错误处理函数

// HandleBadRequest 处理请求错误
func HandleBadRequest(c *gin.Context, message string) {
	HandleError(c, BadRequest(message))
}

// HandleUnauthorized 处理未授权错误
func HandleUnauthorized(c *gin.Context, message string) {
	HandleError(c, Unauthorized(message))
}

// HandleNotFound 处理未找到错误
func HandleNotFound(c *gin.Context, message string) {
	HandleError(c, NotFound(message))
}

// HandleValidationError 处理验证错误
func HandleValidationError(c *gin.Context, message string) {
	HandleError(c, ValidationError(message))
}

// HandleInternalError 处理内部错误
func HandleInternalError(c *gin.Context, err error, operation string) {
	if err == nil {
		return
	}
	internalErr := Wrap(err, ErrCodeInternalError, "Internal server error")
	internalErr.Details = operation
	HandleError(c, internalErr)
}

// HandleDatabaseError 处理数据库错误
func HandleDatabaseError(c *gin.Context, err error, operation string) {
	if err == nil {
		return
	}
	HandleError(c, DatabaseError(err, operation))
}

// 成功响应工具

// SuccessResponse 成功响应结构
type SuccessResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// HandleSuccess 处理成功响应
func HandleSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, SuccessResponse{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

// HandleSuccessWithMessage 处理带自定义消息的成功响应
func HandleSuccessWithMessage(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, SuccessResponse{
		Code:    0,
		Message: message,
		Data:    data,
	})
}