import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 确保是POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed' 
    });
  }

  try {
    // 获取邮箱和密码
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入邮箱和密码' 
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
      // 根据邮箱查找用户
      const [users] = await connection.execute(
        'SELECT id, email, password_hash, created_at FROM users WHERE email = ?', 
        [email]
      );
      
      const user = users[0];

      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: '邮箱或密码错误' 
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          message: '邮箱或密码错误' 
        });
      }

      // 生成JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 返回Token和用户信息
      return res.status(200).json({ 
        success: true,
        message: '登录成功',
        token,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        }
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('[深学助手] 登录API错误:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器内部错误，请稍后重试' 
    });
  }
}