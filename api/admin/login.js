const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDbConnection, handleError, logAdminAction, JWT_SECRET } = require('./middleware');

export default async function handler(req, res) {
  // --- START: 新增的CORS处理逻辑 ---
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://learn-flow-a2jt.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- END: 新增的CORS处理逻辑 ---

  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '方法不被允许'
    });
  }

  const { email, password } = req.body;

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
        req.headers['x-forwarded-for'] || req.connection.remoteAddress
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
      req.headers['x-forwarded-for'] || req.connection.remoteAddress
    );

    // 记录会话到数据库
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    await connection.execute(
      `INSERT INTO user_sessions (user_id, token_hash, session_type, ip_address, user_agent, expires_at)
       VALUES (?, ?, 'admin', ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [
        user.id,
        tokenHash,
        req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        req.headers['user-agent'] || null
      ]
    );

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
    return handleError(error, res, '登录服务暂时不可用');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}