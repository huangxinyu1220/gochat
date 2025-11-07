package tasks

import (
	"time"

	"gochat/internal/logger"
	"gochat/internal/services"
)

// FileCleanupTask 文件清理任务
type FileCleanupTask struct {
	fileService *services.FileService
	ticker      *time.Ticker
	stopChan    chan struct{}
}

// NewFileCleanupTask 创建文件清理任务
func NewFileCleanupTask() *FileCleanupTask {
	return &FileCleanupTask{
		fileService: services.NewFileService(),
		stopChan:    make(chan struct{}),
	}
}

// Start 启动文件清理任务
func (t *FileCleanupTask) Start() {
	log := logger.GetLogger()

	// 每天执行一次清理任务（凌晨2点）
	t.ticker = time.NewTicker(24 * time.Hour)

	// 计算到凌晨2点的延迟
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day()+1, 2, 0, 0, 0, now.Location())
	initialDelay := next.Sub(now)

	log.Infof("文件清理任务已启动，首次执行时间: %s", next.Format("2006-01-02 15:04:05"))

	// 启动后台goroutine
	go func() {
		// 等待到凌晨2点
		time.Sleep(initialDelay)

		// 首次执行
		t.cleanup()

		// 定期执行
		for {
			select {
			case <-t.ticker.C:
				t.cleanup()
			case <-t.stopChan:
				log.Info("文件清理任务已停止")
				return
			}
		}
	}()
}

// Stop 停止文件清理任务
func (t *FileCleanupTask) Stop() {
	if t.ticker != nil {
		t.ticker.Stop()
	}
	close(t.stopChan)
}

// cleanup 执行清理逻辑
func (t *FileCleanupTask) cleanup() {
	log := logger.GetLogger()

	startTime := time.Now()
	log.Info("开始执行文件清理任务...")

	// 清理7天前的孤儿文件
	deletedFiles, err := t.fileService.CleanupOrphanFiles(7)
	if err != nil {
		log.Errorf("文件清理任务失败: %v", err)
		return
	}

	duration := time.Since(startTime)
	log.Infof("文件清理任务完成: 删除=%d个文件, 耗时=%v", len(deletedFiles), duration)

	// 获取存储统计信息
	stats, err := t.fileService.GetStorageStats()
	if err != nil {
		log.Warnf("获取存储统计失败: %v", err)
		return
	}

	log.Infof("存储统计: 总文件=%d, 总大小=%.2fMB, 总引用=%d, 孤儿文件=%d, 去重率=%.2f%%",
		stats["total_files"],
		stats["total_size_mb"],
		stats["total_references"],
		stats["orphan_files"],
		stats["dedup_rate"])
}

// RunNow 立即执行一次清理（用于测试）
func (t *FileCleanupTask) RunNow() {
	t.cleanup()
}
