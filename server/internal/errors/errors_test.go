package errors_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"gochat/internal/errors"
)

func TestAppError(t *testing.T) {
	// 测试创建应用错误
	err := errors.New(errors.ErrCodeBadRequest, "Invalid input")
	assert.Equal(t, errors.ErrCodeBadRequest, err.Code)
	assert.Equal(t, "Invalid input", err.Message)
	assert.Nil(t, err.Cause)

	// 测试错误字符串
	assert.Equal(t, "BAD_REQUEST: Invalid input", err.Error())

	// 测试HTTP状态码
	assert.Equal(t, 400, err.HTTPStatusCode())
}

func TestAppErrorWithCause(t *testing.T) {
	// 创建原始错误
	originalErr := assert.AnError

	// 包装错误
	wrappedErr := errors.Wrap(originalErr, errors.ErrCodeDatabaseError, "Failed to save user")

	assert.Equal(t, errors.ErrCodeDatabaseError, wrappedErr.Code)
	assert.Equal(t, "Failed to save user", wrappedErr.Message)
	assert.Equal(t, originalErr, wrappedErr.Cause)

	// 测试错误字符串包含原始错误
	assert.Contains(t, wrappedErr.Error(), "caused by")

	// 测试Unwrap
	assert.Equal(t, originalErr, wrappedErr.Unwrap())
}

func TestAppErrorWithDetails(t *testing.T) {
	err := errors.New(errors.ErrCodeValidationError, "Validation failed")
	err = err.WithDetails("Field 'email' is required")

	assert.Equal(t, "Field 'email' is required", err.Details)
}

func TestFormattedError(t *testing.T) {
	// 测试格式化错误消息
	err := errors.Newf(errors.ErrCodeNotFound, "User with ID %d not found", 123)

	assert.Equal(t, errors.ErrCodeNotFound, err.Code)
	assert.Equal(t, "User with ID 123 not found", err.Message)
	assert.Equal(t, 404, err.HTTPStatusCode())
}

func TestConvenienceFunctions(t *testing.T) {
	tests := []struct {
		name           string
		errorFunc      func(string) *errors.AppError
		expectedCode   errors.ErrorCode
		expectedStatus int
	}{
		{"BadRequest", errors.BadRequest, errors.ErrCodeBadRequest, 400},
		{"Unauthorized", errors.Unauthorized, errors.ErrCodeUnauthorized, 401},
		{"NotFound", errors.NotFound, errors.ErrCodeNotFound, 404},
		{"InternalError", errors.InternalError, errors.ErrCodeInternalError, 500},
		{"ValidationError", errors.ValidationError, errors.ErrCodeValidationError, 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.errorFunc("test message")
			assert.Equal(t, tt.expectedCode, err.Code)
			assert.Equal(t, "test message", err.Message)
			assert.Equal(t, tt.expectedStatus, err.HTTPStatusCode())
		})
	}
}

func TestDatabaseError(t *testing.T) {
	originalErr := assert.AnError
	err := errors.DatabaseError(originalErr, "insert user")

	assert.Equal(t, errors.ErrCodeDatabaseError, err.Code)
	assert.Equal(t, "Database operation failed: insert user", err.Message)
	assert.Equal(t, originalErr, err.Cause)
	assert.Equal(t, 500, err.HTTPStatusCode())
}

func TestErrorChecking(t *testing.T) {
	appErr := errors.BadRequest("test error")

	// 测试IsAppError
	assert.True(t, errors.IsAppError(appErr))
	assert.False(t, errors.IsAppError(assert.AnError))

	// 测试GetAppError
	retrievedErr := errors.GetAppError(appErr)
	assert.NotNil(t, retrievedErr)
	assert.Equal(t, appErr, retrievedErr)

	retrievedErr = errors.GetAppError(assert.AnError)
	assert.Nil(t, retrievedErr)

	// 测试HasCode
	assert.True(t, errors.HasCode(appErr, errors.ErrCodeBadRequest))
	assert.False(t, errors.HasCode(appErr, errors.ErrCodeNotFound))
	assert.False(t, errors.HasCode(assert.AnError, errors.ErrCodeBadRequest))
}

func TestHTTPStatusCodeMapping(t *testing.T) {
	testCases := map[errors.ErrorCode]int{
		errors.ErrCodeBadRequest:       400,
		errors.ErrCodeUnauthorized:     401,
		errors.ErrCodeForbidden:        403,
		errors.ErrCodeNotFound:         404,
		errors.ErrCodeConflict:         409,
		errors.ErrCodeInternalError:    500,
		errors.ErrCodeServiceUnavailable: 503,
		errors.ErrCodeUserExists:       409,
		errors.ErrCodeUserNotFound:     404,
		errors.ErrCodeInvalidPassword:  401,
	}

	for code, expectedStatus := range testCases {
		t.Run(string(code), func(t *testing.T) {
			err := errors.New(code, "test message")
			assert.Equal(t, expectedStatus, err.HTTPStatusCode())
		})
	}
}

// HTTP处理测试

func TestHTTPErrorHandling(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("HandleAppError", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		appErr := errors.BadRequest("Invalid input data")
		errors.HandleError(c, appErr)

		assert.Equal(t, 400, w.Code)

		var response errors.HTTPErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "BAD_REQUEST", response.Code)
		assert.Equal(t, "Invalid input data", response.Message)
	})

	t.Run("HandleGenericError", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		genericErr := assert.AnError
		errors.HandleError(c, genericErr)

		assert.Equal(t, 500, w.Code)

		var response errors.HTTPErrorResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "INTERNAL_ERROR", response.Code)
		assert.Equal(t, "Internal server error", response.Message)
	})

	t.Run("HandleNilError", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		errors.HandleError(c, nil)

		// 应该没有响应，因为错误为nil
		assert.Equal(t, 200, w.Code) // Gin的默认状态码
		assert.Empty(t, w.Body.String())
	})
}

func TestHTTPConvenienceFunctions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		handlerFunc  func(*gin.Context, string)
		message      string
		expectedCode int
		expectedType string
	}{
		{"BadRequest", errors.HandleBadRequest, "Bad input", 400, "BAD_REQUEST"},
		{"Unauthorized", errors.HandleUnauthorized, "Not logged in", 401, "UNAUTHORIZED"},
		{"NotFound", errors.HandleNotFound, "Resource missing", 404, "NOT_FOUND"},
		{"ValidationError", errors.HandleValidationError, "Invalid field", 400, "VALIDATION_ERROR"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test", nil)

			tt.handlerFunc(c, tt.message)

			assert.Equal(t, tt.expectedCode, w.Code)

			var response errors.HTTPErrorResponse
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedType, response.Code)
			assert.Equal(t, tt.message, response.Message)
		})
	}
}

func TestSuccessResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("HandleSuccess", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		testData := map[string]interface{}{
			"id":   float64(123), // JSON解析后会变成float64
			"name": "Test User",
		}

		errors.HandleSuccess(c, testData)

		assert.Equal(t, 200, w.Code)

		var response errors.SuccessResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, 0, response.Code)
		assert.Equal(t, "success", response.Message)

		// 检查响应数据的结构
		responseData := response.Data.(map[string]interface{})
		assert.Equal(t, float64(123), responseData["id"])
		assert.Equal(t, "Test User", responseData["name"])
	})

	t.Run("HandleSuccessWithMessage", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		customMessage := "User created successfully"
		testData := map[string]interface{}{"user_id": float64(456)} // JSON解析后会变成float64

		errors.HandleSuccessWithMessage(c, customMessage, testData)

		assert.Equal(t, 200, w.Code)

		var response errors.SuccessResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, 0, response.Code)
		assert.Equal(t, customMessage, response.Message)

		// 检查响应数据的结构
		responseData := response.Data.(map[string]interface{})
		assert.Equal(t, float64(456), responseData["user_id"])
	})
}

func TestAbortWithError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)

	appErr := errors.Unauthorized("Access denied")
	errors.AbortWithError(c, appErr)

	// 验证请求被中止
	assert.True(t, c.IsAborted())

	// 验证错误响应
	assert.Equal(t, 401, w.Code)
	var response errors.HTTPErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "UNAUTHORIZED", response.Code)
}