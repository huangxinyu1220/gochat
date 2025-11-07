package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"gochat/internal/errors"
)

// 全局验证器实例
var validate *validator.Validate

func init() {
	validate = validator.New()

	// 注册自定义验证规则
	registerCustomValidations()
}

// registerCustomValidations 注册自定义验证规则
func registerCustomValidations() {
	// 手机号验证（使用安全的验证）
	validate.RegisterValidation("phone", validatePhoneSecure)

	// 密码强度验证（增强版）
	validate.RegisterValidation("password", validatePasswordSecure)

	// 昵称验证（增强版）
	validate.RegisterValidation("nickname", validateNicknameSecure)

	// 安全字符串验证（防止注入）
	validate.RegisterValidation("safestring", validateSafeString)

	// 内容验证（消息内容等）
	validate.RegisterValidation("content", validateContent)
}

// validatePhoneSecure 安全的手机号验证
func validatePhoneSecure(fl validator.FieldLevel) bool {
	phone := fl.Field().String()

	// 基本长度检查
	if len(phone) != 11 {
		return false
	}

	// 必须以1开头（中国手机号）
	if phone[0] != '1' {
		return false
	}

	// 检查是否全为数字
	for _, c := range phone {
		if c < '0' || c > '9' {
			return false
		}
	}

	// 检查常见的无效号码模式
	invalidPatterns := []string{
		"11111111111", "12345678901", "00000000000",
		"99999999999", "10000000000",
	}

	for _, pattern := range invalidPatterns {
		if phone == pattern {
			return false
		}
	}

	return true
}

// validatePasswordSecure 增强的密码验证
func validatePasswordSecure(fl validator.FieldLevel) bool {
	password := fl.Field().String()

	// 长度检查
	if len(password) < 6 || len(password) > 128 {
		return false
	}

	// 检查危险字符
	dangerousChars := []string{
		"<script", "</script", "javascript:", "vbscript:",
		"<iframe", "</iframe", "onload=", "onerror=",
		"<object", "</object", "data:", "src=",
	}

	lowercasePassword := strings.ToLower(password)
	for _, dangerous := range dangerousChars {
		if strings.Contains(lowercasePassword, dangerous) {
			return false
		}
	}

	// 检查SQL注入模式
	sqlPatterns := []string{
		"'", "\"", ";", "--", "/*", "*/",
		" or ", " and ", " union ", " select ",
		" drop ", " delete ", " insert ", " update ",
	}

	for _, pattern := range sqlPatterns {
		if strings.Contains(lowercasePassword, pattern) {
			return false
		}
	}

	return true
}

// validateNicknameSecure 增强的昵称验证
func validateNicknameSecure(fl validator.FieldLevel) bool {
	nickname := fl.Field().String()

	// 长度检查
	if len(nickname) < 1 || len(nickname) > 50 {
		return false
	}

	// 禁止的关键词
	forbidden := []string{
		"admin", "administrator", "root", "system", "null", "undefined",
		"<script", "</script", "javascript", "vbscript", "select", "drop",
		"delete", "update", "insert", "union", "exec", "script",
	}

	lowercaseNickname := strings.ToLower(strings.TrimSpace(nickname))

	for _, word := range forbidden {
		if strings.Contains(lowercaseNickname, word) {
			return false
		}
	}

	// 检查特殊字符模式
	if strings.Contains(nickname, "<") || strings.Contains(nickname, ">") ||
	   strings.Contains(nickname, "&lt;") || strings.Contains(nickname, "&gt;") ||
	   strings.Contains(nickname, "&#") || strings.Contains(nickname, "%3C") {
		return false
	}

	return true
}

// validateSafeString 通用安全字符串验证
func validateSafeString(fl validator.FieldLevel) bool {
	str := fl.Field().String()

	// 检查XSS模式
	xssPatterns := []string{
		"<script", "</script", "javascript:", "vbscript:",
		"onload=", "onerror=", "onmouseover=", "onclick=",
		"<iframe", "<object", "<embed", "<applet",
		"&#x", "&#", "%3C", "%3E", "%22", "%27",
	}

	lowerStr := strings.ToLower(str)
	for _, pattern := range xssPatterns {
		if strings.Contains(lowerStr, pattern) {
			return false
		}
	}

	// 检查SQL注入模式
	sqlPatterns := []string{
		"'", "\"", ";", "--", "/*", "*/",
		" or 1=1", " and 1=1", " union select",
		" drop table", " delete from", " insert into",
		" update ", " exec ", " xp_",
	}

	for _, pattern := range sqlPatterns {
		if strings.Contains(lowerStr, pattern) {
			return false
		}
	}

	return true
}

// validateContent 消息内容验证
func validateContent(fl validator.FieldLevel) bool {
	content := fl.Field().String()

	// 长度检查
	if len(content) > 5000 { // 消息内容不超过5000字符
		return false
	}

	// 检查是否为纯空白字符
	if strings.TrimSpace(content) == "" && content != "" {
		return false
	}

	// 检查重复字符（防止垃圾信息）
	if checkRepeatingPattern(content) {
		return false
	}

	return true
}

// checkRepeatingPattern 检查重复模式
func checkRepeatingPattern(content string) bool {
	if len(content) < 10 {
		return false
	}

	// 检查单字符重复
	charCount := make(map[rune]int)
	for _, char := range content {
		charCount[char]++
		if charCount[char] > len(content)*8/10 { // 某个字符超过80%
			return true
		}
	}

	// 检查短模式重复
	for patternLen := 2; patternLen <= 5; patternLen++ {
		if len(content) >= patternLen*5 { // 至少重复5次
			pattern := content[:patternLen]
			repeated := strings.Repeat(pattern, len(content)/patternLen)
			if strings.HasPrefix(content, repeated[:len(content)]) {
				return true
			}
		}
	}

	return false
}

// ValidateJSON 验证JSON请求体中间件（增强版）
func ValidateJSON(model interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取清理后的上下文
		if sanitized, exists := c.Get("sanitized"); exists {
			if sanitizedCtx, ok := sanitized.(*SanitizedContext); ok {
				if err := sanitizedCtx.SanitizeJSON(model); err != nil {
					handleValidationError(c, err)
					return
				}
			}
		} else {
			// 回退到标准验证
			if err := c.ShouldBindJSON(model); err != nil {
				handleValidationError(c, err)
				return
			}
		}

		// 验证模型字段
		if err := validate.Struct(model); err != nil {
			handleValidationError(c, err)
			return
		}

		// 将验证后的模型存储到上下文中
		c.Set("validated_model", model)
		c.Next()
	}
}

// handleValidationError 处理验证错误
func handleValidationError(c *gin.Context, err error) {
	if validationErrs, ok := err.(validator.ValidationErrors); ok {
		// 验证规则错误
		errorMessages := make([]string, 0)
		for _, fieldErr := range validationErrs {
			errorMessages = append(errorMessages, formatFieldErrorSecure(fieldErr))
		}
		errors.HandleValidationError(c, strings.Join(errorMessages, "; "))
	} else {
		// JSON格式错误或其他错误
		errors.HandleBadRequest(c, "Invalid request format")
	}
}

// formatFieldErrorSecure 安全的字段错误格式化
func formatFieldErrorSecure(fieldErr validator.FieldError) string {
	field := fieldErr.Field()
	tag := fieldErr.Tag()

	switch tag {
	case "required":
		return field + " is required"
	case "email":
		return field + " must be a valid email address"
	case "min":
		return field + " must be at least " + fieldErr.Param() + " characters"
	case "max":
		return field + " must be at most " + fieldErr.Param() + " characters"
	case "phone":
		return field + " must be a valid 11-digit Chinese mobile number"
	case "password":
		return field + " must be 6-128 characters and contain only safe characters"
	case "nickname":
		return field + " must be 1-50 characters and contain only safe characters"
	case "safestring":
		return field + " contains unsafe characters"
	case "content":
		return field + " contains invalid or unsafe content"
	case "len":
		return field + " must be exactly " + fieldErr.Param() + " characters"
	case "oneof":
		return field + " must be one of: " + fieldErr.Param()
	case "numeric":
		return field + " must be numeric"
	case "alphanum":
		return field + " must contain only letters and numbers"
	default:
		return field + " is invalid"
	}
}

// ValidateQuery 查询参数验证中间件（增强版）
func ValidateQuery(rules map[string]string) gin.HandlerFunc {
	return func(c *gin.Context) {
		errorMessages := make([]string, 0)

		for param, rule := range rules {
			value := c.Query(param)

			if rule == "required" && value == "" {
				errorMessages = append(errorMessages, param+" is required")
				continue
			}

			if value != "" {
				// 首先进行安全清理
				if sanitized, exists := c.Get("sanitized"); exists {
					if sanitizedCtx, ok := sanitized.(*SanitizedContext); ok {
						value = sanitizedCtx.SanitizeString(value)
					}
				}

				// 应用验证规则
				switch rule {
				case "numeric":
					if !isNumericSecure(value) {
						errorMessages = append(errorMessages, param+" must be numeric")
					}
				case "safestring":
					if !isSafeString(value) {
						errorMessages = append(errorMessages, param+" contains unsafe characters")
					}
				case "phone":
					if !isValidPhoneNumber(value) {
						errorMessages = append(errorMessages, param+" must be a valid phone number")
					}
				}
			}
		}

		if len(errorMessages) > 0 {
			errors.HandleValidationError(c, strings.Join(errorMessages, "; "))
			return
		}

		c.Next()
	}
}

// isNumericSecure 安全的数字验证
func isNumericSecure(s string) bool {
	if s == "" || len(s) > 20 { // 防止过长的数字
		return false
	}

	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}

	return true
}

// isSafeString 检查字符串是否安全
func isSafeString(s string) bool {
	// 检查长度
	if len(s) > 1000 {
		return false
	}

	// 检查危险模式
	dangerousPatterns := []string{
		"<script", "</script", "javascript:", "vbscript:",
		"<iframe", "<object", "<embed", "onload=", "onerror=",
		"'", "\"", ";", "--", "/*", "*/", "union select",
		"drop table", "delete from", "insert into", "update ",
		"&#", "%3C", "%3E", "%22", "%27",
	}

	lowerStr := strings.ToLower(s)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(lowerStr, pattern) {
			return false
		}
	}

	return true
}

// isValidPhoneNumber 验证手机号
func isValidPhoneNumber(phone string) bool {
	return len(phone) == 11 && phone[0] == '1' && isNumericSecure(phone)
}

// ValidateParam 路径参数验证中间件（增强版）
func ValidateParam(paramName string, validator func(string) bool, errorMessage string) gin.HandlerFunc {
	return func(c *gin.Context) {
		value := c.Param(paramName)

		// 安全清理
		if sanitized, exists := c.Get("sanitized"); exists {
			if sanitizedCtx, ok := sanitized.(*SanitizedContext); ok {
				value = sanitizedCtx.SanitizeString(value)
			}
		}

		if !validator(value) {
			errors.HandleBadRequest(c, errorMessage)
			return
		}

		c.Next()
	}
}

// RequiredAuth 要求认证中间件（增强版）
func RequiredAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			errors.HandleUnauthorized(c, "Authentication required")
			return
		}

		// 确保用户ID是有效的int64
		if _, ok := userID.(int64); !ok {
			errors.HandleUnauthorized(c, "Invalid user session")
			return
		}

		c.Next()
	}
}

// ContentTypeJSON 要求Content-Type为JSON的中间件（增强版）
func ContentTypeJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		contentType := c.GetHeader("Content-Type")

		if !strings.Contains(contentType, "application/json") {
			errors.HandleBadRequest(c, "Content-Type must be application/json")
			return
		}

		c.Next()
	}
}

// PaginationValidation 分页参数验证中间件（增强版）
func PaginationValidation() gin.HandlerFunc {
	return func(c *gin.Context) {
		page := c.DefaultQuery("page", "1")
		pageSize := c.DefaultQuery("page_size", "20")

		// 清理输入
		if sanitized, exists := c.Get("sanitized"); exists {
			if sanitizedCtx, ok := sanitized.(*SanitizedContext); ok {
				page = sanitizedCtx.SanitizeString(page)
				pageSize = sanitizedCtx.SanitizeString(pageSize)
			}
		}

		if !isNumericSecure(page) || !isPositiveIntSecure(page) {
			errors.HandleBadRequest(c, "page must be a positive integer")
			return
		}

		if !isNumericSecure(pageSize) || !isValidPageSizeSecure(pageSize) {
			errors.HandleBadRequest(c, "page_size must be between 1 and 100")
			return
		}

		c.Next()
	}
}

// isPositiveIntSecure 检查是否为正整数（安全版）
func isPositiveIntSecure(s string) bool {
	if !isNumericSecure(s) || len(s) > 10 { // 限制长度防止溢出
		return false
	}
	return s != "0" && s != ""
}

// isValidPageSizeSecure 检查页面大小是否有效（安全版）
func isValidPageSizeSecure(s string) bool {
	if !isPositiveIntSecure(s) || len(s) > 3 { // 最大3位数
		return false
	}

	// 简单检查：1位数字或者两位数不超过100
	if len(s) == 1 {
		return true
	}
	if len(s) == 2 {
		return s[0] <= '9' && !(s[0] == '9' && s[1] > '9') // <=99
	}
	if len(s) == 3 {
		return s == "100"
	}

	return false
}

// GetValidatedModel 从上下文中获取验证后的模型
func GetValidatedModel(c *gin.Context) interface{} {
	model, exists := c.Get("validated_model")
	if !exists {
		return nil
	}
	return model
}