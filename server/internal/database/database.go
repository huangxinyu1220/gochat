package database

import (
	"fmt"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"gochat/internal/config"
	"gochat/internal/models"
)

var DB *gorm.DB

// Init 初始化数据库连接
func Init(cfg *config.DatabaseConfig) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // 关闭SQL日志输出
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// 配置连接池
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return nil
}

// GetDB 获取数据库连接
func GetDB() *gorm.DB {
	return DB
}

// Migrate 执行数据库迁移
func Migrate() error {
	// 先禁用外键检查
	DB.Exec("SET FOREIGN_KEY_CHECKS = 0")

	// 执行迁移
	err := DB.AutoMigrate(
		&models.User{},
		&models.FriendRelation{},
		&models.Group{},
		&models.GroupMember{},
		&models.Message{},
		&models.Conversation{},
		&models.FileStorage{},    // 新增：文件存储表
		&models.FileReference{},  // 新增：文件引用表
	)

	// 重新启用外键检查
	DB.Exec("SET FOREIGN_KEY_CHECKS = 1")

	return err
}

// Close 关闭数据库连接
func Close() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
