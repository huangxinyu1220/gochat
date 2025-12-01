package utils

import (
	"fmt"
	"io"
	"net/http"
)

// DetectMimeType 检测文件的真实MIME类型
func DetectMimeType(file io.ReadSeeker) (string, error) {
	// 读取前512字节用于MIME类型检测
	buffer := make([]byte, 512)
	_, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	// 重置文件指针到开始位置
	_, err = file.Seek(0, 0)
	if err != nil {
		return "", err
	}

	// 使用http.DetectContentType检测MIME类型
	mimeType := http.DetectContentType(buffer)
	return mimeType, nil
}

// ValidateImageMimeType 验证是否为允许的图片MIME类型
func ValidateImageMimeType(mimeType string) bool {
	allowedMimeTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}
	return allowedMimeTypes[mimeType]
}

// ValidateExtensionMimeTypeMatch 验证扩展名和MIME类型是否匹配
func ValidateExtensionMimeTypeMatch(ext, mimeType string) bool {
	validCombinations := map[string][]string{
		".jpg":  {"image/jpeg", "image/jpg"},
		".jpeg": {"image/jpeg", "image/jpg"},
		".png":  {"image/png"},
		".gif":  {"image/gif"},
		".webp": {"image/webp"},
	}

	allowedMimeTypes, exists := validCombinations[ext]
	if !exists {
		return false
	}

	for _, allowedMimeType := range allowedMimeTypes {
		if allowedMimeType == mimeType {
			return true
		}
	}
	return false
}

// ValidateImageFile 完整的图片文件验证（扩展名+MIME类型）
func ValidateImageFile(file io.ReadSeeker, filename string, ext string) error {
	// 检测文件的真实MIME类型
	mimeType, err := DetectMimeType(file)
	if err != nil {
		return fmt.Errorf("failed to detect file type: %v", err)
	}

	// 验证MIME类型是否为允许的图片类型
	if !ValidateImageMimeType(mimeType) {
		return fmt.Errorf("invalid file type detected: %s. Only image files are allowed", mimeType)
	}

	// 验证文件扩展名和MIME类型是否匹配（防止文件伪装）
	if !ValidateExtensionMimeTypeMatch(ext, mimeType) {
		return fmt.Errorf("file extension %s does not match detected file type %s", ext, mimeType)
	}

	return nil
}

// ValidateAudioMimeType 验证是否为允许的音频MIME类型
func ValidateAudioMimeType(mimeType string) bool {
	allowedMimeTypes := map[string]bool{
		"audio/webm":         true,
		"audio/mp4":          true,
		"audio/mpeg":         true,
		"audio/ogg":          true,
		"audio/wav":          true,
		"audio/x-wav":        true,
		"audio/m4a":          true,
		"audio/x-m4a":        true,
		"audio/aac":          true,
		"video/webm":         true, // WebM音频有时被检测为video/webm
		"application/ogg":    true, // Ogg音频有时被检测为application/ogg
		"application/octet-stream": true, // 某些浏览器可能返回通用类型
	}
	return allowedMimeTypes[mimeType]
}

// ValidateAudioExtensionMimeTypeMatch 验证音频扩展名和MIME类型是否匹配
func ValidateAudioExtensionMimeTypeMatch(ext, mimeType string) bool {
	validCombinations := map[string][]string{
		".webm": {"audio/webm", "video/webm", "application/octet-stream"},
		".mp4":  {"audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "application/octet-stream"},
		".m4a":  {"audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "application/octet-stream"},
		".mp3":  {"audio/mpeg", "application/octet-stream"},
		".ogg":  {"audio/ogg", "application/ogg", "application/octet-stream"},
		".wav":  {"audio/wav", "audio/x-wav", "application/octet-stream"},
		".aac":  {"audio/aac", "audio/mp4", "application/octet-stream"},
	}

	allowedMimeTypes, exists := validCombinations[ext]
	if !exists {
		return false
	}

	for _, allowedMimeType := range allowedMimeTypes {
		if allowedMimeType == mimeType {
			return true
		}
	}
	return false
}

// ValidateAudioFile 完整的音频文件验证（扩展名+MIME类型）
func ValidateAudioFile(file io.ReadSeeker, filename string, ext string) error {
	// 检测文件的真实MIME类型
	mimeType, err := DetectMimeType(file)
	if err != nil {
		return fmt.Errorf("failed to detect file type: %v", err)
	}

	// 验证MIME类型是否为允许的音频类型
	if !ValidateAudioMimeType(mimeType) {
		return fmt.Errorf("invalid file type detected: %s. Only audio files are allowed", mimeType)
	}

	// 验证文件扩展名和MIME类型是否匹配（防止文件伪装）
	if !ValidateAudioExtensionMimeTypeMatch(ext, mimeType) {
		return fmt.Errorf("file extension %s does not match detected file type %s", ext, mimeType)
	}

	return nil
}