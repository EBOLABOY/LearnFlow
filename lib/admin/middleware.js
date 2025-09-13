const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// 数据库配置 - 从环境变量中提供以便灵活部署
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  // 按需使用 MySQL2 支持的连接池选项，避免过度配置
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  ssl: {
    // 兼容自签证书或未验证证书（如目标数据库要求）
    rejectUnauthorized: false
  }
};

// 校验必要的环境变量
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('[安全检查] 缺失必要环境变量', missingEnvVars.join(', '));
  throw new Error(`缺失必要环境变量 ${missingEnvVars.join(', ')}`);
}

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// JWT 密钥 - 从环境变量提供
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[安全检查] JWT_SECRET 未设置或长度不足 32 位');
  throw new Error('JWT_SECRET必须设置且长度不少于32位字符');
}

/**
 * 管理员认证中间件
 * 校验 JWT token，确保用户具有管理员权限
 */
async function requireAdmin(req, res, next) {
  const startTime = Date.now();
  let authStatus = 'unknown';
  let userId = null;

  try {
    // 从请求头获取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      authStatus = 'no_token';
      logSecurityEvent('AUTH_FAILED', 'missing_token', req);
      return res.status(401).json({ success: false, message: '缺少认证信息' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      authStatus = 'invalid_token';
      logSecurityEvent('AUTH_FAILED', err?.name || 'invalid_token', req);
      return res.status(401).json({ success: false, message: '认证失败，请重新登录' });
    }

    const connection = await getDbConnection();
    const [users] = await connection.execute(
      'SELECT id, email, role, is_active, last_login_at FROM users WHERE id = ? LIMIT 1',
      [decoded.userId]
    );
    connection.release();

    if (!users.length) {
      authStatus = 'user_not_found';
      logSecurityEvent('AUTH_FAILED', 'user_not_found', req);
      return res.status(401).json({ success: false, message: '认证失败，请重新登录' });
    }

    const user = users[0];
    userId = user.id;

    if (user.is_active !== 1) {
      authStatus = 'account_disabled';
      logSecurityEvent('AUTH_FAILED', 'account_disabled', req, user.id);
      return res.status(403).json({ success: false, message: '账户已被禁用' });
    }

    if (user.role !== 'admin') {
      authStatus = 'not_admin';
      logSecurityEvent('AUTH_FAILED', 'not_admin', req, user.id);
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    req.user = user;
    req.adminId = user.id;
    req.clientIp = (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || req.connection?.remoteAddress || null;

    authStatus = 'success';
    return next();
  } catch (error) {
    console.error('[admin requireAdmin] unhandled error', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  } finally {
    try {
      await logSecurityEvent('AUTH_AUDIT', authStatus, req, userId, { durationMs: Date.now() - startTime });
    } catch {}
  }
}

/**
 * 统一获取数据库连接（从连接池）
 */
async function getDbConnection() {
  return pool.getConnection();
}

/**
 * 安全与审计日志（简化版）
 */
async function logSecurityEvent(eventType, reason, req, userId = null, extra = {}) {
  try {
    const connection = await getDbConnection();
    await connection.execute(
      `INSERT INTO security_logs (event_type, reason, user_id, ip_address, user_agent, created_at, extra)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [
        String(eventType || 'UNKNOWN'),
        String(reason || ''),
        userId,
        (req?.headers?.['x-forwarded-for']?.split(',')[0] || '').trim() || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || req?.connection?.remoteAddress || null,
        req?.headers?.['user-agent'] || null,
        JSON.stringify(extra || {})
      ]
    );
    connection.release();
  } catch {}
}

/**
 * 管理操作日志
 */
async function logAdminAction(adminId, action, targetType, targetId = null, details = {}, clientIp = null) {
  try {
    const connection = await getDbConnection();
    await connection.execute(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, client_ip, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [adminId, String(action || ''), String(targetType || ''), targetId, clientIp, JSON.stringify(details || {})]
    );
    connection.release();
  } catch (e) {
    console.error('[admin audit] failed to record', e?.message);
  }
}

/**
 * 统一错误处理
 */
function handleError(error, res, message = '服务器内部错误', req = null) {
  const errorId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // SQL 相关错误
  if (error?.code && typeof error.code === 'string') {
    console.error('[SQL错误]', { errorId, code: error.code, errno: error.errno, message: error.message });
  }

  // 数据库连接错误
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
    console.error('[数据库连接失败]', { errorId, code: error.code });
    return res.status(503).json({ success: false, message: '数据库连接超时，请稍后重试', errorId });
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

  // 数据校验错误
  if (error?.name === 'ValidationError') {
    console.warn('[校验错误]', { errorId, details: error.details });
    return res.status(400).json({ success: false, message: '请求参数校验失败', errorId, details: error.details });
  }

  // 默认服务器内部错误
  console.error('[未知错误]', { errorId, error: error?.message });
  return res.status(500).json({ success: false, message, errorId });
}

/**
 * 分页参数
 */
function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * 搜索条件
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

/**
 * 排序参数（白名单字段映射）
 * @param {import('http').IncomingMessage} req
 * @param {Record<string,string>} allowedMap - 如 { key: 'table.column' }
 * @param {string} defaultKey - 默认排序字段 key（必须在 allowedMap 中）
 * @param {('ASC'|'DESC')} defaultDir - 默认方向
 */
function getSortParams(req, allowedMap = {}, defaultKey = null, defaultDir = 'DESC') {
  const sortByRaw = (req.query?.sortBy || '').toString();
  const sortDirRaw = (req.query?.sortDir || '').toString().toLowerCase();
  const direction = sortDirRaw === 'asc' ? 'ASC' : sortDirRaw === 'desc' ? 'DESC' : (defaultDir || 'DESC');

  const key = allowedMap[sortByRaw] ? sortByRaw : (defaultKey && allowedMap[defaultKey] ? defaultKey : null);
  const columnExpr = key ? allowedMap[key] : null;

  if (columnExpr) {
    return { clause: `ORDER BY ${columnExpr} ${direction}`, key, direction };
  }
  return { clause: '', key: null, direction };
}

module.exports = {
  requireAdmin,
  logAdminAction,
  logSecurityEvent,
  getDbConnection,
  handleError,
  getPaginationParams,
  buildSearchQuery,
  getSortParams,
  JWT_SECRET,
  pool
};

