-- 数据库初始化脚本
-- 创建数据库（如果不存在）

CREATE DATABASE IF NOT EXISTS im_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE im_db;

-- 注意：表结构由 GORM 自动迁移创建
-- 这个脚本只负责创建数据库和设置字符集

-- 设置时区（可选）
SET time_zone = '+00:00';

-- 显示当前数据库信息
SELECT 'Database im_db initialized successfully' AS status;
