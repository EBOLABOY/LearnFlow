const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// 数据库配置 - 生产环境必须提供所有环境变量
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  // 仅使用 MySQL2 支持的连接池选项，避免未来版本报错
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  ssl: {
    // 允许自签名证书或未验证的证书（部分云数据库需要）
    rejectUnauthorized: false
  }
};

// 验证必需的环境变量
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('[安全配置] 缺少必需的环境变量', missingEnvVars.join(', '));
  throw new Error(`缺少必需的环境变量 ${missingEnvVars.join(', ')}`);
}

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// JWT密钥 - 生产环境必须提供
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[安全配置] JWT_SECRET未设置或长度不足32位');
  throw new Error('JWT_SECRET必须设置且长度不少于32位字符');
}

/**
 * 管理员认证中间件
 * 验证JWT token并确保用户具有管理员权限
 */
async function requireAdmin(req, res, next) {
  const startTime = Date.now();
  let authStatus = 'unknown';
  let userId = null;

  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      authStatus = 'no_token';
      logSecurityEvent('AUTH_FAILED', 'missing_token', req);
      return res.status(401).json({ success: false, message: '缺少认证令牌' });
    }

    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀

    // 验证JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (jwtError) {
      authStatus = 'invalid_token';
      logSecurityEvent('AUTH_FAILED', 'invalid_token', req, {
        error: jwtError.name,
        userId: userId
      });
      return res.status(401).json({ success: false, message: '无效的认证令牌' });
    }

    // 从数据库获取用户信息
    const connection = await pool.getConnection();
    try {
      const dbStart = Date.now();
      const [users] = await connection.execute(
        'SELECT id, email, role, is_active, last_login_at FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
        [decoded.userId]
      );
      const dbDuration = Date.now() - dbStart;
      if (dbDuration > 500) {
        console.warn('[性能警告] 认证查询耗时较长', { dbDuration, userId: decoded.userId });
      }

      if (users.length === 0) {
        authStatus = 'user_not_found';
        logSecurityEvent('AUTH_FAILED', 'user_not_found_or_disabled', req, { userId: decoded.userId });
        return res.status(401).json({ success: false, message: '用户不存在或已被禁用' });
      }

      const user = users[0];

      // 验证管理员权限
      if (user.role !== 'admin') {
        authStatus = 'insufficient_privileges';
        logSecurityEvent('AUTH_FAILED', 'insufficient_privileges', req, {
          userId: user.id,
          userRole: user.role
        });
        return res.status(403).json({ success: false, message: '权限不足，需要管理员权限' });
      }

      // 认证成功
      authStatus = 'success';

      // 将用户信息添加到请求对象
      req.user = user;
      req.adminId = user.id;

      // 记录管理员操作的IP地址
      req.clientIp =
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        (req.connection && req.connection.socket ? req.connection.socket.remoteAddress : null);

      // 记录成功的认证
      logSecurityEvent('AUTH_SUCCESS', 'admin_access', req, {
        userId: user.id,
        email: user.email,
        endpoint: req.url,
        method: req.method
      });

      next();
    } finally {
      connection.release();
    }
  } catch (error) {
    authStatus = 'system_error';
    console.error('[管理员认证中间件] 系统错误:', {
      error: error.message,
      stack: error.stack,
      userId,
      endpoint: req.url,
      method: req.method,
      duration: Date.now() - startTime
    });

    logSecurityEvent('AUTH_ERROR', 'system_error', req, { error: error.message, userId });

    return res.status(500).json({ success: false, message: '认证服务暂时不可用' });
  } finally {
    // 记录认证性能指标
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn('[性能警告] 认证中间件响应时间过长', {
        duration,
        endpoint: req.url,
        authStatus,
        userId
      });
    }
  }
}

/**
 * 记录安全事件
 */
function logSecurityEvent(eventType, eventAction, req, details = null) {
  const clientIp =
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';

  const securityLog = {
    timestamp: new Date().toISOString(),
    eventType,
    eventAction,
    endpoint: req.url,
    method: req.method,
    clientIp,
    userAgent,
    details: details || {},
    sessionId: req.headers['x-session-id'] || null
  };

  // 根据事件类型选择日志级别
  if (eventType.includes('FAILED') || eventType.includes('ERROR')) {
    console.error('[安全事件]', JSON.stringify(securityLog));
  } else if (eventType.includes('SUCCESS')) {
    console.info('[安全事件]', JSON.stringify(securityLog));
  } else {
    console.warn('[安全事件]', JSON.stringify(securityLog));
  }

  // 对于严重的安全事件，可以在这里添加告警机制
  const criticalEvents = ['AUTH_FAILED', 'AUTH_ERROR', 'BRUTE_FORCE_ATTEMPT'];
  if (criticalEvents.includes(eventType)) {
    // 这里可以集成告警系统，如邮件、短信、Slack 等
    console.error('[严重安全事件] 需要关注', securityLog);
  }
}

/**
 * 记录管理员操作日志
 */
async function logAdminAction(
  adminId,
  action,
  targetType,
  targetId = null,
  details = null,
  ipAddress = null
) {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress]
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[管理员日志] 记录失败:', error);
    // 日志记录失败不应影响主要业务流程
  }
}

/**
 * 数据库连接助手
 */
async function getDbConnection() {
  return await pool.getConnection();
}

/**
 * 通用错误处理
 */
function handleError(error, res, message = '服务器内部错误', req = null) {
  // 生成错误ID用于追踪
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  // 详细的错误日志
  const errorLog = {
    errorId,
    timestamp: new Date().toISOString(),
    message: error?.message,
    stack: error?.stack,
    code: error?.code,
    errno: error?.errno,
    sqlState: error?.sqlState,
    endpoint: req?.url,
    method: req?.method,
    userAgent: req?.headers?.['user-agent'],
    clientIp: req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip']
  };

  console.error('[API错误]', JSON.stringify(errorLog));

  // 数据重复错误
  if (error?.code === 'ER_DUP_ENTRY') {
    const duplicateField = error.message.match(/for key '(.+?)'/)?.[1] || 'unknown';
    console.warn('[数据重复]', { errorId, field: duplicateField, endpoint: req?.url });
    return res.status(400).json({ success: false, message: '数据已存在，请检查输入', errorId });
  }

  // 外键约束错误
  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    console.warn('[外键约束]', { errorId, endpoint: req?.url });
    return res.status(400).json({ success: false, message: '引用的数据不存在', errorId });
  }

  // 数据库连接错误
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
    console.error('[数据库连接失败]', { errorId, code: error.code });
    return res.status(503).json({ success: false, message: '数据库服务暂时不可用', errorId });
  }

  // JWT 相关错误
  if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    console.warn('[JWT错误]', { errorId, name: error.name, endpoint: req?.url });
    return res.status(401).json({ success: false, message: '认证失败，请重新登录', errorId });
  }

  // 权限错误
  if (error?.code === 'PERMISSION_DENIED') {
    console.warn('[权限错误]', { errorId, endpoint: req?.url });
    return res.status(403).json({ success: false, message: '权限不足', errorId });
  }

  // 请求验证错误
  if (error?.name === 'ValidationError') {
    console.warn('[验证错误]', { errorId, details: error.details });
    return res.status(400).json({ success: false, message: '请求参数验证失败', errorId, details: error.details });
  }

  // 默认服务器内部错误
  console.error('[未知错误]', { errorId, error: error?.message });
  return res.status(500).json({ success: false, message, errorId });
}

/**
 * 分页助手
 */
function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * 搜索助手
 */
function buildSearchQuery(searchTerm, searchFields) {
  if (!searchTerm || !searchFields.length) {
    return { whereClause: '', params: [] };
  }
  const conditions = searchFields.map((field) => `${field} LIKE ?`);
  const whereClause = `AND (${conditions.join(' OR ')})`;
  const params = searchFields.map(() => `%${searchTerm}%`);
  return { whereClause, params };
}

module.exports = {
  requireAdmin,
  logAdminAction,
  logSecurityEvent,
  getDbConnection,
  handleError,
  getPaginationParams,
  buildSearchQuery,
  JWT_SECRET,
  pool
};

