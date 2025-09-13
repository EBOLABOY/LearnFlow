// 统一后端数据库与安全配置桥接（ESM）
// 从 CommonJS 的 admin 中间件复用同一连接池与 JWT 配置，避免重复创建连接池
// 注意：此文件需使用 UTF-8 编码

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 复用现有的 admin 中间件导出（CommonJS）
// 包含：pool, getDbConnection, JWT_SECRET, handleError 等
// 仅导出通用部分，避免普通用户 API 与管理员 API 各自创建连接池
const adminMiddleware = require('./admin/middleware.js');
const adminAuth = require('./admin/auth.js');

export const pool = adminMiddleware.pool;
export const getDbConnection = adminMiddleware.getDbConnection;
export const JWT_SECRET = adminMiddleware.JWT_SECRET;

// 透出通用错误处理（按需使用）
export const handleError = adminMiddleware.handleError;

// 为向后兼容，提供一个简易的 getPool()
export function getPool() {
  return pool;
}

// 统一导出核心认证方法（供 ESM 使用）
export const authenticateUser = adminAuth.authenticateUser;

