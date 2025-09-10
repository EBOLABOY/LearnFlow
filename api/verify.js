import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

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

  // 支持GET和POST请求
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed' 
    });
  }

  try {
    // 从Authorization头或请求体中获取token
    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.method === 'POST' && req.body.token) {
      token = req.body.token;
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '未提供认证令牌' 
      });
    }

    // 验证JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        message: '认证令牌无效或已过期' 
      });
    }

    // 连接数据库验证用户是否仍然存在
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
      const [users] = await connection.execute(
        'SELECT id, email, created_at FROM users WHERE id = ?', 
        [decoded.userId]
      );

      const user = users[0];
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: '用户不存在' 
        });
      }

      // 返回验证成功信息
      return res.status(200).json({ 
        success: true,
        message: '认证成功',
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
        },
        tokenInfo: {
          issuedAt: new Date(decoded.iat * 1000),
          expiresAt: new Date(decoded.exp * 1000)
        }
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('[深学助手] Token验证API错误:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
}