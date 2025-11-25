package utils

import (
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"gochat/internal/config"
)

// HashPassword 密码哈希
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

// CheckPasswordHash 验证密码
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateToken 生成JWT token
func GenerateToken(userID int64, cfg *config.JWTConfig) (string, int64, error) {
	// 计算过期时间
	expireAt := time.Now().Add(time.Hour * time.Duration(cfg.ExpireHours)).Unix()

	// 创建claims
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     expireAt,
		"iat":     time.Now().Unix(),
	}

	// 创建token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 签名token
	tokenString, err := token.SignedString([]byte(cfg.Secret))
	if err != nil {
		return "", 0, err
	}

	return tokenString, expireAt, nil
}

// ValidateToken 验证JWT token并返回userID
func ValidateToken(tokenString string, cfg *config.JWTConfig) (int64, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.Secret), nil
	})

	if err != nil {
		return 0, err
	}

	if !token.Valid {
		return 0, errors.New("invalid token")
	}

	// 提取claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("invalid token claims")
	}

	// 获取用户ID
	userID, ok := claims["user_id"].(float64)
	if !ok {
		return 0, errors.New("user_id not found in token")
	}

	return int64(userID), nil
}

// ValidatePhone 验证手机号格式
func ValidatePhone(phone string) bool {
	if len(phone) != 11 {
		return false
	}
	for _, c := range phone {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// ValidatePassword 验证密码强度
func ValidatePassword(password string) bool {
	return len(password) >= 6 && len(password) <= 20
}

// ValidateNickname 验证昵称
func ValidateNickname(nickname string) bool {
	// 使用utf8.RuneCountInString来正确计算Unicode字符数量，而不是字节数
	runeCount := utf8.RuneCountInString(nickname)
	return runeCount >= 2 && runeCount <= 20
}

// FormatResponse 格式化API响应
func FormatResponse(code int, message string, data interface{}) map[string]interface{} {
	return map[string]interface{}{
		"code":    code,
		"message": message,
		"data":    data,
	}
}

// SuccessResponse 成功响应
func SuccessResponse(data interface{}) map[string]interface{} {
	return FormatResponse(0, "success", data)
}

// ErrorResponse 错误响应
func ErrorResponse(code int, message string) map[string]interface{} {
	return FormatResponse(code, message, nil)
}
