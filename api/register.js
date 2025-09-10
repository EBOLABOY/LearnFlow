import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 确保这是POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed' 
    });
  }

  try {
    // 从请求体中获取数据
    const { email, password, inviteCode } = req.body;

    // 验证输入
    if (!email || !password || !inviteCode) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要信息' 
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱格式无效' 
      });
    }

    // 验证密码强度
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: '密码至少需要6位字符' 
      });
    }

    // 验证邀请码
    if (inviteCode !== process.env.INVITE_CODE) {
      return res.status(403).json({ 
        success: false, 
        message: '邀请码无效' 
      });
    }

    // 连接数据库
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      // 检查邮箱是否已存在
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ?', 
        [email]
      );
      
      if (existingUsers.length > 0) {
        return res.status(409).json({ 
          success: false, 
          message: '该邮箱已被注册' 
        });
      }

      // 对密码进行哈希加密
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // 将新用户插入数据库
      const [result] = await connection.execute(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)', 
        [email, passwordHash]
      );

      // 返回成功响应
      return res.status(201).json({ 
        success: true, 
        message: '注册成功',
        userId: result.insertId 
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('[深学助手] 注册API错误:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器内部错误，请稍后重试' 
    });
  }
}