package database

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// DefaultQueryTimeout 默认查询超时时间
const DefaultQueryTimeout = 10 * time.Second

// ContextDB 带上下文的数据库包装器
type ContextDB struct {
	db *gorm.DB
}

// NewContextDB 创建带上下文的数据库包装器
func NewContextDB(db *gorm.DB) *ContextDB {
	return &ContextDB{db: db}
}

// WithTimeout 创建带超时的上下文
func (cdb *ContextDB) WithTimeout(timeout time.Duration) (*gorm.DB, context.CancelFunc) {
	if timeout == 0 {
		timeout = DefaultQueryTimeout
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	return cdb.db.WithContext(ctx), cancel
}

// WithTimeoutCtx 使用自定义上下文创建带超时的数据库连接
func (cdb *ContextDB) WithTimeoutCtx(ctx context.Context, timeout time.Duration) (*gorm.DB, context.CancelFunc) {
	if timeout == 0 {
		timeout = DefaultQueryTimeout
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
	return cdb.db.WithContext(timeoutCtx), cancel
}

// Query 执行带超时的查询操作
func (cdb *ContextDB) Query(timeout time.Duration, fn func(*gorm.DB) error) error {
	db, cancel := cdb.WithTimeout(timeout)
	defer cancel()
	return fn(db)
}

// QueryCtx 执行带超时和上下文的查询操作
func (cdb *ContextDB) QueryCtx(ctx context.Context, timeout time.Duration, fn func(*gorm.DB) error) error {
	db, cancel := cdb.WithTimeoutCtx(ctx, timeout)
	defer cancel()
	return fn(db)
}

// GetContextDB 获取带上下文的数据库包装器
func GetContextDB() *ContextDB {
	return NewContextDB(DB)
}

// QueryWithTimeout 便捷函数：执行带超时的查询
func QueryWithTimeout(timeout time.Duration, fn func(*gorm.DB) error) error {
	return GetContextDB().Query(timeout, fn)
}

// QueryWithTimeoutCtx 便捷函数：执行带超时和上下文的查询
func QueryWithTimeoutCtx(ctx context.Context, timeout time.Duration, fn func(*gorm.DB) error) error {
	return GetContextDB().QueryCtx(ctx, timeout, fn)
}