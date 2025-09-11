const { requireAdmin, handleError } = require('./middleware');

export default async function handler(req, res) {
  // 只允许GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: '方法不被允许'
    });
  }

  // 应用管理员认证中间件
  try {
    await new Promise((resolve, reject) => {
      requireAdmin(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch (error) {
    return; // 中间件已经发送了响应
  }

  try {
    // 返回管理员信息（已通过中间件验证）
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        lastLogin: req.user.last_login_at,
        status: req.user.is_active === 1 ? 'active' : 'disabled'
      }
    });

  } catch (error) {
    console.error('[管理员资料] 错误:', error);
    return handleError(error, res, '获取管理员信息失败');
  }
}