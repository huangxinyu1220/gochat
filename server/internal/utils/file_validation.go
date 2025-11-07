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