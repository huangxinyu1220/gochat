package database

import (
	"gorm.io/gorm"
	"gochat/internal/logger"
)

// OptimizeDatabase 数据库优化 - 添加索引和优化查询
func OptimizeDatabase(db *gorm.DB) error {
	logger.GetLogger().Info("Starting database optimization...")

	// 消息表索引优化
	if err := optimizeMessageIndexes(db); err != nil {
		return err
	}

	// 用户表索引优化
	if err := optimizeUserIndexes(db); err != nil {
		return err
	}

	// 会话表索引优化
	if err := optimizeConversationIndexes(db); err != nil {
		return err
	}

	// 好友关系表索引优化
	if err := optimizeFriendIndexes(db); err != nil {
		return err
	}

	// 群组表索引优化
	if err := optimizeGroupIndexes(db); err != nil {
		return err
	}

	// 文件存储表索引优化
	if err := optimizeFileStorageIndexes(db); err != nil {
		return err
	}

	logger.GetLogger().Info("Database optimization completed successfully")
	return nil
}

// optimizeMessageIndexes 优化消息表索引
func optimizeMessageIndexes(db *gorm.DB) error {
	logger.GetLogger().Info("Optimizing message table indexes...")

	indexes := []string{
		// 单聊消息查询索引 - 支持双向查询和时间排序
		"CREATE INDEX IF NOT EXISTS idx_messages_private_chat ON messages(from_user_id, to_user_id, created_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_messages_private_chat_reverse ON messages(to_user_id, from_user_id, created_at DESC)",

		// 群聊消息查询索引
		"CREATE INDEX IF NOT EXISTS idx_messages_group_chat ON messages(group_id, created_at DESC) WHERE group_id IS NOT NULL",

		// 发送者查询索引
		"CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id, created_at DESC)",

		// 接收者查询索引
		"CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, created_at DESC) WHERE to_user_id IS NOT NULL",

		// 消息类型索引
		"CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(msg_type)",

		// 复合索引 - 用户消息按时间排序（优化分页查询）
		"CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages(from_user_id, to_user_id, group_id, created_at DESC)",

		// 未读消息查询索引
		"CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(to_user_id, is_read, created_at) WHERE to_user_id IS NOT NULL",
	}

	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to create message index: %v", err)
			// 继续执行其他索引，不要因为一个失败就停止
		}
	}

	return nil
}

// optimizeUserIndexes 优化用户表索引
func optimizeUserIndexes(db *gorm.DB) error {
	logger.GetLogger().Info("Optimizing user table indexes...")

	indexes := []string{
		// 手机号唯一索引（应该已存在，但确保存在）
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)",

		// 昵称搜索索引
		"CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname)",

		// 创建时间索引
		"CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)",

		// 复合索引 - 手机号和状态
		"CREATE INDEX IF NOT EXISTS idx_users_phone_active ON users(phone, created_at)",
	}

	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to create user index: %v", err)
		}
	}

	return nil
}

// optimizeConversationIndexes 优化会话表索引
func optimizeConversationIndexes(db *gorm.DB) error {
	logger.GetLogger().Info("Optimizing conversation table indexes...")

	indexes := []string{
		// 用户会话查询索引
		"CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC)",

		// 会话类型索引
		"CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type)",

		// 目标ID索引
		"CREATE INDEX IF NOT EXISTS idx_conversations_target ON conversations(target_id)",

		// 复合索引 - 用户会话列表查询
		"CREATE INDEX IF NOT EXISTS idx_conversations_user_list ON conversations(user_id, type, updated_at DESC)",

		// 未读消息统计索引
		"CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(user_id, unread_count) WHERE unread_count > 0",

		// 最后消息索引
		"CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_msg_id, updated_at DESC)",
	}

	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to create conversation index: %v", err)
		}
	}

	return nil
}

// optimizeFriendIndexes 优化好友关系表索引
func optimizeFriendIndexes(db *gorm.DB) error {
	logger.GetLogger().Info("Optimizing friend_relations table indexes...")

	indexes := []string{
		// 用户好友列表查询索引
		"CREATE INDEX IF NOT EXISTS idx_friend_relations_user ON friend_relations(user_id, created_at DESC)",

		// 好友查询索引
		"CREATE INDEX IF NOT EXISTS idx_friend_relations_friend ON friend_relations(friend_id)",

		// 双向好友关系查询索引
		"CREATE INDEX IF NOT EXISTS idx_friend_relations_both ON friend_relations(user_id, friend_id)",

		// 创建时间索引
		"CREATE INDEX IF NOT EXISTS idx_friend_relations_created ON friend_relations(created_at)",
	}

	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to create friend_relations index: %v", err)
		}
	}

	return nil
}

// optimizeGroupIndexes 优化群组表索引
func optimizeGroupIndexes(db *gorm.DB) error {
	logger.GetLogger().Info("Optimizing groups and group_members table indexes...")

	indexes := []string{
		// 群组名称搜索索引
		"CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name)",

		// 群组所有者索引
		"CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id, created_at DESC)",

		// 群组成员数量索引
		"CREATE INDEX IF NOT EXISTS idx_groups_member_count ON groups(member_count)",

		// 群组成员 - 群组ID索引
		"CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id, joined_at DESC)",

		// 群组成员 - 用户ID索引
		"CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id, joined_at DESC)",

		// 群组成员 - 复合索引
		"CREATE INDEX IF NOT EXISTS idx_group_members_both ON group_members(group_id, user_id)",
	}

	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to create group index: %v", err)
		}
	}

	return nil
}

// optimizeFileStorageIndexes 优化文件存储表索引
func optimizeFileStorageIndexes(db *gorm.DB) error {
	logger.GetLogger().Info("Optimizing file storage table indexes...")

	indexes := []string{
		// 文件哈希唯一索引（用于去重）
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_file_storage_hash ON file_storage(hash)",

		// 文件类型索引
		"CREATE INDEX IF NOT EXISTS idx_file_storage_mime ON file_storage(mime_type)",

		// 文件大小索引
		"CREATE INDEX IF NOT EXISTS idx_file_storage_size ON file_storage(file_size)",

		// 引用计数索引
		"CREATE INDEX IF NOT EXISTS idx_file_storage_ref_count ON file_storage(ref_count)",

		// 创建时间索引
		"CREATE INDEX IF NOT EXISTS idx_file_storage_created ON file_storage(created_at)",

		// 文件引用 - 文件ID索引
		"CREATE INDEX IF NOT EXISTS idx_file_reference_file ON file_reference(file_id)",

		// 文件引用 - 用户ID索引
		"CREATE INDEX IF NOT EXISTS idx_file_reference_user ON file_reference(user_id)",

		// 文件引用 - 引用类型索引
		"CREATE INDEX IF NOT EXISTS idx_file_reference_type ON file_reference(ref_type, ref_id)",

		// 文件引用 - 复合索引
		"CREATE INDEX IF NOT EXISTS idx_file_reference_user_type ON file_reference(user_id, ref_type, created_at DESC)",
	}

	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to create file storage index: %v", err)
		}
	}

	return nil
}

// AnalyzeDatabase 分析数据库性能
func AnalyzeDatabase(db *gorm.DB) error {
	logger.GetLogger().Info("Analyzing database performance...")

	// 分析表统计信息
	tables := []string{"messages", "users", "conversations", "friend_relations", "groups", "group_members", "file_storage", "file_reference"}

	for _, table := range tables {
		var count int64
		if err := db.Table(table).Count(&count).Error; err != nil {
			logger.GetLogger().Warnf("Failed to count table %s: %v", table, err)
		} else {
			logger.GetLogger().Infof("Table %s: %d records", table, count)
		}

		// 更新表统计信息（MySQL）
		sql := "ANALYZE TABLE " + table
		if err := db.Exec(sql).Error; err != nil {
			logger.GetLogger().Warnf("Failed to analyze table %s: %v", table, err)
		}
	}

	return nil
}

// GetDatabaseStats 获取数据库统计信息
func GetDatabaseStats(db *gorm.DB) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 获取表大小信息
	rows, err := db.Raw(`
		SELECT
			table_name,
			table_rows,
			data_length,
			index_length,
			(data_length + index_length) as total_size
		FROM information_schema.tables
		WHERE table_schema = DATABASE()
		ORDER BY total_size DESC
	`).Rows()

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tableStats []map[string]interface{}
	for rows.Next() {
		var tableName string
		var tableRows, dataLength, indexLength, totalSize int64

		if err := rows.Scan(&tableName, &tableRows, &dataLength, &indexLength, &totalSize); err != nil {
			continue
		}

		tableInfo := map[string]interface{}{
			"table_name":   tableName,
			"table_rows":   tableRows,
			"data_length":  dataLength,
			"index_length": indexLength,
			"total_size":   totalSize,
		}
		tableStats = append(tableStats, tableInfo)
	}

	stats["tables"] = tableStats

	// 获取索引使用情况
	indexRows, err := db.Raw(`
		SELECT
			table_name,
			index_name,
			cardinality,
			index_type
		FROM information_schema.statistics
		WHERE table_schema = DATABASE()
		AND index_name != 'PRIMARY'
		ORDER BY table_name, cardinality DESC
	`).Rows()

	if err == nil {
		defer indexRows.Close()
		var indexStats []map[string]interface{}

		for indexRows.Next() {
			var tableName, indexName, indexType string
			var cardinality int64

			if err := indexRows.Scan(&tableName, &indexName, &cardinality, &indexType); err != nil {
				continue
			}

			indexInfo := map[string]interface{}{
				"table_name":  tableName,
				"index_name":  indexName,
				"cardinality": cardinality,
				"index_type":  indexType,
			}
			indexStats = append(indexStats, indexInfo)
		}

		stats["indexes"] = indexStats
	}

	return stats, nil
}