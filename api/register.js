import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

// 数据库配置（使用环境变量，避免硬编码，并使用连接池支持的选项）
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = mysql.createPool(dbConfig);

export default async function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 确保这是 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let connection;

  try {
    // 从请求体中获取数据
    const { email, password, inviteCode } = req.body;

    // 验证输入
    if (!email || !password || !inviteCode) {
      return res.status(400).json({ success: false, message: '缺少必要信息' });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式无效' });
    }

    // 验证密码强度
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少需要 6 位字符' });
    }

    // 获取连接（来自连接池）
    connection = await pool.getConnection();

    // 开始事务
    await connection.beginTransaction();

    try {
      // 验证邀请码（新的动态邀请码系统）
      const [invitations] = await connection.execute(
        `SELECT id, code, created_by, expires_at, used_by
         FROM invitation_codes
         WHERE code = ? AND used_by IS NULL AND expires_at > NOW()`,
        [inviteCode.trim().toUpperCase()]
      );

      if (invitations.length === 0) {
        return res.status(403).json({ success: false, message: '邀请码无效、已被使用或已过期' });
      }

      const invitation = invitations[0];

      // 检查邮箱是否已存在
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [email.toLowerCase().trim()]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ success: false, message: '该邮箱已被注册' });
      }

      // 对密码进行哈希加密
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // 将新用户插入数据库（默认为普通用户）
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, "user")',
        [email.toLowerCase().trim(), passwordHash]
      );

      const newUserId = userResult.insertId;

      // 更新邀请码状态（标记为已使用）
      await connection.execute('UPDATE invitation_codes SET used_by = ?, used_at = NOW() WHERE id = ?', [
        newUserId,
        invitation.id
      ]);

      // 记录注册会话（可选，用于跟踪用户来源）
      await connection.execute(
        `INSERT INTO user_sessions (user_id, token_hash, session_type, ip_address, user_agent, expires_at)
         VALUES (?, ?, 'extension', ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
        [
          newUserId,
          'REGISTRATION_SESSION',
          req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
          req.headers['user-agent'] || null
        ]
      );

      // 提交事务
      await connection.commit();

      console.log(`[深学助手] 新用户注册成功: ${email} (ID: ${newUserId})`);

      // 返回成功响应
      return res.status(201).json({
        success: true,
        message: '注册成功，请使用您的邮箱登录',
        userId: newUserId,
        data: {
          email: email.toLowerCase().trim(),
          role: 'user',
          registeredAt: new Date().toISOString()
        }
      });
    } catch (transactionError) {
      // 回滚事务
      await connection.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('[深学助手] 注册API错误:', error);

    // 数据库约束错误处理
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '该邮箱已被注册' });
    }

    // 外键约束错误
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: '邀请码数据异常，请联系管理员' });
    }

    return res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  } finally {
    // 确保连接被释放
    if (connection) {
      connection.release();
    }
  }
}

