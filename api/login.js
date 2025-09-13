import jwt from 'jsonwebtoken';
import { JWT_SECRET, authenticateUser } from './db.js';
import { applyCors } from './cors.js';

export default async function handler(req, res) {
  // 统一 CORS 处理
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 确保是 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '请输入邮箱和密码' });
    }

    // 统一认证
    const user = await authenticateUser(email, password);

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: '登录成功',
      token,
      user: { id: user.id, email: user.email, createdAt: user.created_at }
    });
  } catch (error) {
    console.error('[深学助手] 登录API错误:', error);
    // 认证失败统一提示（不暴露具体原因）
    if (error?.name === 'AuthError') {
      return res.status(401).json({ success: false, message: '邮箱或密码错误' });
    }
    return res.status(500).json({ success: false, message: '服务器内部错误，请稍后重试' });
  }
}
