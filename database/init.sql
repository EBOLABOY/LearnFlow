-- 深学助手用户认证系统数据库初始化脚本
-- 数据库: learnflow
-- 主机: mysql2.sqlpub.com:3307
-- 版本: v2.0 - 多应用系统支持角色管理和动态邀请码

-- 创建用户表（扩展支持角色系统）
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户唯一标识',
  `email` VARCHAR(255) NOT NULL UNIQUE COMMENT '用户邮箱（登录名）',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt加密后的密码哈希',
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user' COMMENT '用户角色：普通用户或管理员',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login` TIMESTAMP NULL COMMENT '最后登录时间',
  `status` ENUM('active', 'disabled') DEFAULT 'active' COMMENT '用户状态',
  INDEX `idx_email` (`email`),
  INDEX `idx_role` (`role`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户认证表（支持角色管理）';

-- 创建邀请码表（动态邀请码管理系统）
CREATE TABLE IF NOT EXISTS `invitation_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '邀请码唯一标识',
  `code` VARCHAR(32) NOT NULL UNIQUE COMMENT '邀请码字符串（唯一）',
  `created_by` INT NOT NULL COMMENT '创建此邀请码的管理员ID',
  `used_by` INT NULL COMMENT '使用此邀请码注册的用户ID（NULL表示未使用）',
  `expires_at` TIMESTAMP NOT NULL COMMENT '邀请码过期时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `used_at` TIMESTAMP NULL COMMENT '使用时间（NULL表示未使用）',
  `status` ENUM('active', 'used', 'expired', 'revoked') AS (
    CASE 
      WHEN `used_by` IS NOT NULL THEN 'used'
      WHEN `expires_at` < NOW() THEN 'expired'
      ELSE 'active'
    END
  ) STORED COMMENT '邀请码状态（计算字段）',
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_code` (`code`),
  INDEX `idx_created_by` (`created_by`),
  INDEX `idx_used_by` (`used_by`),
  INDEX `idx_expires_at` (`expires_at`),
  INDEX `idx_status_computed` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='动态邀请码管理表';

-- 创建用户会话表（JWT令牌管理）
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL COMMENT 'JWT token的哈希值',
  `session_type` ENUM('extension', 'admin') NOT NULL DEFAULT 'extension' COMMENT '会话类型：扩展API或管理后台',
  `ip_address` VARCHAR(45) COMMENT '登录IP地址',
  `user_agent` TEXT COMMENT '用户代理信息',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_expires_at` (`expires_at`),
  INDEX `idx_session_type` (`session_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表（支持多应用）';

-- 创建管理操作日志表（审计追踪）
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL COMMENT '执行操作的管理员ID',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型',
  `target_type` ENUM('user', 'invitation_code', 'system') NOT NULL COMMENT '操作目标类型',
  `target_id` INT NULL COMMENT '操作目标ID',
  `details` JSON NULL COMMENT '操作详情（JSON格式）',
  `ip_address` VARCHAR(45) COMMENT '操作来源IP',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  INDEX `idx_admin_id` (`admin_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员操作审计日志';

-- 插入默认管理员账户（请在生产环境中修改密码）
-- 密码: admin123 (请立即修改)
INSERT IGNORE INTO `users` (`email`, `password_hash`, `role`) VALUES 
('admin@learnflow.app', '$2a$12$v5OWVL5.KpLBpNJx2VwCSOWJZJhvAo.P2D3Dj7w/AKhYsN5Y9.F6.', 'admin');

-- 创建初始邀请码（由系统管理员创建）
-- 这些邀请码将在管理后台创建后替换
INSERT IGNORE INTO `invitation_codes` (`code`, `created_by`, `expires_at`) 
SELECT 'WELCOME2024', u.id, DATE_ADD(NOW(), INTERVAL 30 DAY)
FROM `users` u WHERE u.role = 'admin' LIMIT 1;

-- 显示创建的表结构
DESCRIBE `users`;
DESCRIBE `invitation_codes`;
DESCRIBE `user_sessions`;
DESCRIBE `admin_logs`;

-- 显示初始数据
SELECT 'Initial Admin User:' as info;
SELECT id, email, role, created_at FROM `users` WHERE role = 'admin';

SELECT 'Initial Invitation Codes:' as info;
SELECT id, code, created_by, expires_at, status FROM `invitation_codes`;

-- 数据库架构升级完成
SELECT 'Database Schema v2.0 initialized successfully!' as status;