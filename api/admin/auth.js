// 管理端/通用认证服务（CommonJS）
// 注意：此文件需使用 UTF-8 编码
const bcrypt = require('bcryptjs');
const { getDbConnection } = require('./middleware');

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code; // 如：INVALID_CREDENTIALS, ACCOUNT_DISABLED
  }
}

/**
 * 核心用户认证函数：根据邮箱与密码校验用户。
 * 成功返回完整用户对象（含 created_at / last_login_at / role / is_active）。
 * 失败抛出 AuthError（不暴露具体枚举信息给外部响应）。
 */
async function authenticateUser(email, password) {
  let connection;
  try {
    connection = await getDbConnection();
    const [users] = await connection.execute(
      `SELECT id, email, password_hash, role, is_active, last_login_at, created_at
       FROM users WHERE email = ? LIMIT 1`,
      [String(email || '').toLowerCase().trim()]
    );

    if (users.length === 0) {
      throw new AuthError('INVALID_CREDENTIALS', '用户不存在或密码错误');
    }

    const user = users[0];

    if (user.is_active !== 1) {
      throw new AuthError('ACCOUNT_DISABLED', '账户已被禁用');
    }

    const ok = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!ok) {
      throw new AuthError('INVALID_CREDENTIALS', '用户不存在或密码错误');
    }

    return user;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  authenticateUser,
  AuthError,
};

