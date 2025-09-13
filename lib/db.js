// lib/db.js
// 统一后端数据库与安全配置桥接 (CommonJS)
// 从 admin 中间件复用同一连接池与 JWT 配置

// 直接使用 require，不再需要 createRequire 桥接
const adminMiddleware = require('./admin/middleware.js');
const adminAuth = require('./admin/auth.js');

// 导出共享模块
module.exports = {
  pool: adminMiddleware.pool,
  getDbConnection: adminMiddleware.getDbConnection,
  JWT_SECRET: adminMiddleware.JWT_SECRET,
  handleError: adminMiddleware.handleError, // 透出通用错误处理
  authenticateUser: adminAuth.authenticateUser, // 统一导出核心认证方法
  
  // 为向后兼容提供 getPool()
  getPool: function() {
    return adminMiddleware.pool;
  }
};
