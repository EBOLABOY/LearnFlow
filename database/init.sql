-- 深学助手用户认证系统数据库初始化脚本
-- 数据库: learnflow
-- 主机: mysql2.sqlpub.com:3307

-- 创建用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户唯一标识',
  `email` VARCHAR(255) NOT NULL UNIQUE COMMENT '用户邮箱（登录名）',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt加密后的密码哈希',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login` TIMESTAMP NULL COMMENT '最后登录时间',
  `status` ENUM('active', 'disabled') DEFAULT 'active' COMMENT '用户状态',
  INDEX `idx_email` (`email`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户认证表';

-- 创建用户会话表（可选，用于记录登录历史）
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL COMMENT 'JWT token的哈希值',
  `ip_address` VARCHAR(45) COMMENT '登录IP地址',
  `user_agent` TEXT COMMENT '用户代理信息',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表';

-- 插入测试数据（可选）
-- 密码: testpass123 (bcrypt哈希后的值)
-- INSERT INTO `users` (`email`, `password_hash`) VALUES 
-- ('test@example.com', '$2a$12$example_hash_here');

-- 显示创建的表结构
DESCRIBE `users`;
DESCRIBE `user_sessions`;