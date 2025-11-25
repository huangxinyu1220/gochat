package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"

	"gochat/internal/database"
	"gochat/internal/logger"
	"gochat/internal/models"
)

// 统一文件存储目录
const FileStorageDir = "uploads/files"

type FileService struct {
	db *gorm.DB
}

func NewFileService() *FileService {
	return &FileService{
		db: database.GetDB(),
	}
}

// UploadFileResult 上传文件结果
type UploadFileResult struct {
	FileStorage  *models.FileStorage
	IsDedup      bool   // 是否是去重（秒传）
	URL          string // 访问URL
}

// UploadFile 上传文件（全局去重系统）
func (s *FileService) UploadFile(
	file multipart.File,
	header *multipart.FileHeader,
	userID int64,
	refType string,
	uploadDir string, // 为兼容性保留，实际使用统一目录
) (*UploadFileResult, error) {
	log := logger.GetLogger()

	// 1. 重置文件指针到开始位置
	if _, err := file.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to seek file: %w", err)
	}

	// 2. 计算文件哈希
	hash, err := s.CalculateFileHash(file)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate hash: %w", err)
	}

	// 3. 重置文件指针（计算哈希后需要重置）
	if _, err := file.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to seek file: %w", err)
	}

	// 4. 检查文件是否已存在（全局去重）
	var existingFile models.FileStorage
	result := s.db.Where("hash = ?", hash).First(&existingFile)

	if result.Error == nil {
		// 文件已存在，执行去重逻辑
		log.Infof("文件去重命中: hash=%s, 用户=%d, 类型=%s", hash[:16], userID, refType)

		// 增加引用计数
		if err := s.IncrementRefCount(existingFile.ID); err != nil {
			return nil, fmt.Errorf("failed to increment ref count: %w", err)
		}

		// 创建新的引用记录
		if err := s.CreateReference(existingFile.ID, userID, refType, 0); err != nil {
			// 引用创建失败，回滚引用计数
			s.DecrementRefCount(existingFile.ID)
			return nil, fmt.Errorf("failed to create reference: %w", err)
		}

		// 返回现有文件信息
		return &UploadFileResult{
			FileStorage: &existingFile,
			IsDedup:     true,
			URL:         existingFile.StoragePath,
		}, nil
	}

	// 5. 文件不存在，需要创建新文件
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("database error: %w", result.Error)
	}

	// 6. 获取文件扩展名
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}

	// 7. 使用统一存储目录和哈希值作为文件名
	newFileName := fmt.Sprintf("%s%s", hash, ext)
	storagePath := filepath.Join(FileStorageDir, newFileName)
	fullPath := filepath.Join("./", storagePath)

	// 8. 确保统一存储目录存在
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	// 9. 保存文件到统一存储目录
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()

	fileSize, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(fullPath) // 清理失败的文件
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	// 10. 创建数据库记录
	newFile := &models.FileStorage{
		Hash:        hash,
		FileName:    header.Filename,
		FileSize:    fileSize,
		MimeType:    header.Header.Get("Content-Type"),
		StoragePath: storagePath, // 统一存储路径
		RefCount:    1,
	}

	if err := s.db.Create(newFile).Error; err != nil {
		os.Remove(fullPath) // 清理已保存的文件
		return nil, fmt.Errorf("failed to create file record: %w", err)
	}

	// 11. 创建引用记录
	if err := s.CreateReference(newFile.ID, userID, refType, 0); err != nil {
		// 引用创建失败，回滚
		s.db.Delete(newFile)
		os.Remove(fullPath)
		return nil, fmt.Errorf("failed to create reference: %w", err)
	}

	log.Infof("文件上传成功: hash=%s, size=%d, user=%d, type=%s, path=%s",
		hash[:16], fileSize, userID, refType, storagePath)

	return &UploadFileResult{
		FileStorage: newFile,
		IsDedup:     false,
		URL:         storagePath,
	}, nil
}

// CalculateFileHash 计算文件SHA256哈希
func (s *FileService) CalculateFileHash(file multipart.File) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// GetFileByHash 根据哈希查找文件
func (s *FileService) GetFileByHash(hash string) (*models.FileStorage, error) {
	var file models.FileStorage
	if err := s.db.Where("hash = ?", hash).First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

// GetFileByID 根据ID查找文件
func (s *FileService) GetFileByID(fileID int64) (*models.FileStorage, error) {
	var file models.FileStorage
	if err := s.db.First(&file, fileID).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

// IncrementRefCount 增加引用计数
func (s *FileService) IncrementRefCount(fileID int64) error {
	return s.db.Model(&models.FileStorage{}).
		Where("id = ?", fileID).
		UpdateColumn("ref_count", gorm.Expr("ref_count + 1")).
		Error
}

// DecrementRefCount 减少引用计数
func (s *FileService) DecrementRefCount(fileID int64) error {
	return s.db.Model(&models.FileStorage{}).
		Where("id = ?", fileID).
		UpdateColumn("ref_count", gorm.Expr("ref_count - 1")).
		Error
}

// CreateReference 创建文件引用记录
func (s *FileService) CreateReference(fileID, userID int64, refType string, refID int64) error {
	// 检查是否已存在相同的引用记录
	var existingRef models.FileReference
	result := s.db.Where("file_id = ? AND user_id = ? AND ref_type = ?", fileID, userID, refType).
		First(&existingRef)

	if result.Error == nil {
		// 已存在相同的引用记录，直接返回成功
		return nil
	}

	// 不存在则创建新的引用记录
	ref := &models.FileReference{
		FileID:  fileID,
		UserID:  userID,
		RefType: refType,
		RefID:   refID,
	}
	return s.db.Create(ref).Error
}

// DeleteReference 删除引用（软删除）
func (s *FileService) DeleteReference(fileID, userID int64, refType string) error {
	log := logger.GetLogger()

	// 软删除引用记录
	result := s.db.Where("file_id = ? AND user_id = ? AND ref_type = ?", fileID, userID, refType).
		Delete(&models.FileReference{})

	if result.Error != nil {
		return result.Error
	}

	// 如果删除成功，减少引用计数
	if result.RowsAffected > 0 {
		if err := s.DecrementRefCount(fileID); err != nil {
			log.Errorf("减少引用计数失败: fileID=%d, error=%v", fileID, err)
			return err
		}
	}

	return nil
}

// GetReferencesByUser 获取用户的文件引用
func (s *FileService) GetReferencesByUser(userID int64, refType string) ([]models.FileReference, error) {
	var refs []models.FileReference
	query := s.db.Where("user_id = ?", userID)

	if refType != "" {
		query = query.Where("ref_type = ?", refType)
	}

	if err := query.Find(&refs).Error; err != nil {
		return nil, err
	}
	return refs, nil
}

// CleanupOrphanFiles 清理孤儿文件（引用计数为0且创建时间超过指定天数）
func (s *FileService) CleanupOrphanFiles(olderThanDays int) ([]string, error) {
	log := logger.GetLogger()

	// 计算截止时间
	cutoffTime := time.Now().AddDate(0, 0, -olderThanDays)

	// 查找符合条件的孤儿文件
	var orphanFiles []models.FileStorage
	if err := s.db.Where("ref_count = 0 AND created_at < ?", cutoffTime).
		Find(&orphanFiles).Error; err != nil {
		return nil, fmt.Errorf("failed to query orphan files: %w", err)
	}

	if len(orphanFiles) == 0 {
		log.Info("没有需要清理的孤儿文件")
		return []string{}, nil
	}

	deletedPaths := []string{}
	totalSize := int64(0)

	// 删除文件
	for _, file := range orphanFiles {
		// 删除物理文件
		fullPath := filepath.Join("./", file.StoragePath)
		if err := os.Remove(fullPath); err != nil {
			if !os.IsNotExist(err) {
				log.Warnf("删除文件失败: path=%s, error=%v", fullPath, err)
			}
		} else {
			deletedPaths = append(deletedPaths, file.StoragePath)
			totalSize += file.FileSize
		}

		// 删除数据库记录
		if err := s.db.Delete(&file).Error; err != nil {
			log.Errorf("删除文件记录失败: id=%d, error=%v", file.ID, err)
		}
	}

	log.Infof("清理孤儿文件完成: 删除=%d个文件, 释放空间=%d字节 (%.2fMB)",
		len(deletedPaths), totalSize, float64(totalSize)/1024/1024)

	return deletedPaths, nil
}

// GetStorageStats 获取存储统计信息
func (s *FileService) GetStorageStats() (map[string]interface{}, error) {
	var stats struct {
		TotalFiles    int64
		TotalSize     int64
		TotalRefs     int64
		OrphanFiles   int64
		AverageRefCount float64
	}

	// 总文件数和总大小
	s.db.Model(&models.FileStorage{}).Count(&stats.TotalFiles)
	s.db.Model(&models.FileStorage{}).Select("COALESCE(SUM(file_size), 0)").Scan(&stats.TotalSize)

	// 总引用数
	s.db.Model(&models.FileReference{}).Count(&stats.TotalRefs)

	// 孤儿文件数
	s.db.Model(&models.FileStorage{}).Where("ref_count = 0").Count(&stats.OrphanFiles)

	// 平均引用计数
	if stats.TotalFiles > 0 {
		s.db.Model(&models.FileStorage{}).Select("AVG(ref_count)").Scan(&stats.AverageRefCount)
	}

	return map[string]interface{}{
		"total_files":       stats.TotalFiles,
		"total_size_bytes":  stats.TotalSize,
		"total_size_mb":     float64(stats.TotalSize) / 1024 / 1024,
		"total_references":  stats.TotalRefs,
		"orphan_files":      stats.OrphanFiles,
		"average_ref_count": stats.AverageRefCount,
		"dedup_rate":        float64(stats.TotalRefs-stats.TotalFiles) / float64(stats.TotalRefs) * 100,
	}, nil
}
