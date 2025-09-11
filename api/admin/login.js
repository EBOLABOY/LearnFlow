const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDbConnection, handleError, logAdminAction, JWT_SECRET } = require('./middleware');

export default async function handler(req, res) {
  // --- START: CORS处理（支持多域名） ---
  const corsEnv = process.env.CORS_ORIGIN || 'https://learn-flow-a2jt.vercel.app';
  const requestOrigin = req.headers.origin;
  let allowOrigin = corsEnv;
  if (requestOrigin && corsEnv.includes(',')) {
    const whitelist = corsEnv.split(',').map(o => o.trim()).filter(Boolean);
    if (whitelist.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else if (whitelist.length > 0) {
      allowOrigin = whitelist[0];
    }
  } else if (requestOrigin && corsEnv === '*') {
    // 搭配 credentials 时不应返回 *，退化为请求源
    allowOrigin = requestOrigin;
  }
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- END: CORS处理 ---

  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '方法不被允许'
    });
  }

  const { email, password } = req.body || {};

  // 输入验证
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: '邮箱和密码不能为空'
    });
  }

  // 邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: '邮箱格式不正确'
    });
  }

  let connection;
  // 统一计算客户端IP，避免 req.connection 未定义导致异常
  const clientIp =
    (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null;
  
  try {
    connection = await getDbConnection();

    // 查找管理员用户
    const [users] = await connection.execute(
      `SELECT id, email, password_hash, role, is_active, last_login_at 
       FROM users 
       WHERE email = ? AND role = 'admin'`,
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '管理员账户不存在'
      });
    }

    const user = users[0];

    // 检查账户状态
    if (user.is_active !== 1) {
      return res.status(401).json({
        success: false,
        message: '账户已被禁用，请联系系统管理员'
      });
    }

    // 验证密码
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      // 记录登录失败
      await logAdminAction(
        user.id, 
        'login_failed', 
        'system', 
        null, 
        { email, reason: 'invalid_password' },
        clientIp
      );

      return res.status(401).json({
        success: false,
        message: '密码错误'
      });
    }

    // 更新最后登录时间
    await connection.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // 生成JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'admin' // 标记为管理员token
      },
      JWT_SECRET,
      { expiresIn: '7d' } // 7天过期
    );

    // 记录成功登录
    await logAdminAction(
      user.id,
      'login_success',
      'system',
      null,
      { email },
      clientIp
    );

    // 记录会话到数据库（失败不阻断登录流程）
    try {
      const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
      await connection.execute(
        `INSERT INTO user_sessions (user_id, token_hash, session_type, ip_address, user_agent, expires_at)
         VALUES (?, ?, 'admin', ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [
          user.id,
          tokenHash,
          clientIp,
          req.headers['user-agent'] || null
        ]
      );
    } catch (sessionErr) {
      console.error('[管理员登录] 记录会话失败（已忽略）:', {
        code: sessionErr.code,
        errno: sessionErr.errno,
        message: sessionErr.message
      });
      // 不中断后续返回
    }

    // 返回成功响应（不包含敏感信息）
    return res.status(200).json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        lastLogin: user.last_login_at
      }
    });

  } catch (error) {
    console.error('[管理员登录] 错误:', error);
    return handleError(error, res, '登录服务暂时不可用', req);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
