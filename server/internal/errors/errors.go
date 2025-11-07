package errors

import (
	"errors"
	"fmt"
)

// ErrorCode 错误代码类型
type ErrorCode string

// 预定义错误代码
const (
	// 客户端错误 4xx
	ErrCodeBadRequest      ErrorCode = "BAD_REQUEST"
	ErrCodeUnauthorized    ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden       ErrorCode = "FORBIDDEN"
	ErrCodeNotFound        ErrorCode = "NOT_FOUND"
	ErrCodeConflict        ErrorCode = "CONFLICT"
	ErrCodeValidationError ErrorCode = "VALIDATION_ERROR"

	// 服务器错误 5xx
	ErrCodeInternalError    ErrorCode = "INTERNAL_ERROR"
	ErrCodeDatabaseError    ErrorCode = "DATABASE_ERROR"
	ErrCodeExternalService  ErrorCode = "EXTERNAL_SERVICE_ERROR"
	ErrCodeServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"

	// 业务逻辑错误
	ErrCodeUserExists       ErrorCode = "USER_EXISTS"
	ErrCodeUserNotFound     ErrorCode = "USER_NOT_FOUND"
	ErrCodeInvalidPassword  ErrorCode = "INVALID_PASSWORD"
	ErrCodeFriendExists     ErrorCode = "FRIEND_EXISTS"
	ErrCodeNotFriends       ErrorCode = "NOT_FRIENDS"
	ErrCodeGroupNotFound    ErrorCode = "GROUP_NOT_FOUND"
	ErrCodeNotGroupMember   ErrorCode = "NOT_GROUP_MEMBER"
	ErrCodeMessageNotFound  ErrorCode = "MESSAGE_NOT_FOUND"
)

// AppError 应用程序错误类型
type AppError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details string    `json:"details,omitempty"`
	Cause   error     `json:"-"` // 原始错误，不序列化
}

// Error 实现 error 接口
func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap 支持 errors.Unwrap
func (e *AppError) Unwrap() error {
	return e.Cause
}

// HTTPStatusCode 获取对应的HTTP状态码
func (e *AppError) HTTPStatusCode() int {
	switch e.Code {
	case ErrCodeBadRequest, ErrCodeValidationError:
		return 400
	case ErrCodeUnauthorized, ErrCodeInvalidPassword:
		return 401
	case ErrCodeForbidden:
		return 403
	case ErrCodeNotFound, ErrCodeUserNotFound, ErrCodeGroupNotFound, ErrCodeMessageNotFound:
		return 404
	case ErrCodeConflict, ErrCodeUserExists, ErrCodeFriendExists:
		return 409
	case ErrCodeServiceUnavailable:
		return 503
	default:
		return 500
	}
}

// 构造函数

// New 创建新的应用错误
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

// Newf 创建带格式化消息的应用错误
func Newf(code ErrorCode, format string, args ...interface{}) *AppError {
	return &AppError{
		Code:    code,
		Message: fmt.Sprintf(format, args...),
	}
}

// Wrap 包装现有错误
func Wrap(err error, code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Cause:   err,
	}
}

// Wrapf 包装现有错误并格式化消息
func Wrapf(err error, code ErrorCode, format string, args ...interface{}) *AppError {
	return &AppError{
		Code:    code,
		Message: fmt.Sprintf(format, args...),
		Cause:   err,
	}
}

// WithDetails 添加详细信息
func (e *AppError) WithDetails(details string) *AppError {
	e.Details = details
	return e
}

// 便捷函数

// BadRequest 创建请求错误
func BadRequest(message string) *AppError {
	return New(ErrCodeBadRequest, message)
}

// Unauthorized 创建未授权错误
func Unauthorized(message string) *AppError {
	return New(ErrCodeUnauthorized, message)
}

// NotFound 创建未找到错误
func NotFound(message string) *AppError {
	return New(ErrCodeNotFound, message)
}

// InternalError 创建内部错误
func InternalError(message string) *AppError {
	return New(ErrCodeInternalError, message)
}

// DatabaseError 包装数据库错误
func DatabaseError(err error, operation string) *AppError {
	return Wrap(err, ErrCodeDatabaseError, fmt.Sprintf("Database operation failed: %s", operation))
}

// ValidationError 创建验证错误
func ValidationError(message string) *AppError {
	return New(ErrCodeValidationError, message)
}

// 错误检查函数

// IsAppError 检查是否为应用错误
func IsAppError(err error) bool {
	var appErr *AppError
	return errors.As(err, &appErr)
}

// GetAppError 获取应用错误
func GetAppError(err error) *AppError {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return nil
}

// HasCode 检查错误是否具有指定代码
func HasCode(err error, code ErrorCode) bool {
	if appErr := GetAppError(err); appErr != nil {
		return appErr.Code == code
	}
	return false
}