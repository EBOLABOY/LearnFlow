const jwt = require('jsonwebtoken');
const { getDbConnection, handleError, logAdminAction, JWT_SECRET } = require('../../lib/admin/middleware.js');
const { applyAdminCors } = require('../../lib/admin/cors.js');
const { authenticateUser, AuthError } = require('../../lib/admin/auth.js');

export default async function handler(req, res) {
  // Apply consistent CORS for admin APIs
  applyAdminCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password } = req.body || {};

  // Basic input validation
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  // Compute client IP robustly
  const clientIp =
    (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null;

  try {
    const user = await authenticateUser(email, password);
    if (user.role !== 'admin') {
      // 非管理员账号
      try { await logAdminAction(user.id ?? null, 'login_failed', 'system', null, { email, reason: 'not_admin' }, clientIp); } catch {}
      return res.status(403).json({ success: false, message: '权限不足，需要管理员权限' });
    }

    // Update last login timestamp
    const connection = await getDbConnection();
    await connection.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    connection.release();

    // Issue JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log successful login
    await logAdminAction(user.id, 'login_success', 'system', null, { email }, clientIp);

    // Persist session (best-effort; non-blocking on failure)
    try {
      const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
      await connection.execute(
        `INSERT INTO user_sessions (user_id, token_hash, session_type, ip_address, user_agent, expires_at)
         VALUES (?, ?, 'admin', ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [user.id, tokenHash, clientIp, req.headers['user-agent'] || null]
      );
    } catch (sessionErr) {
      console.error('[admin login] failed to record session (ignored)', {
        code: sessionErr.code,
        errno: sessionErr.errno,
        message: sessionErr.message,
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      message: 'Login success',
      token,
      user: { id: user.id, email: user.email, role: user.role, lastLogin: user.last_login_at },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // 区分原因用于审计日志
      const reason = error.code === 'ACCOUNT_DISABLED' ? 'account_disabled' : 'invalid_credentials';
      try {
        // best-effort: 没有 userId 可记录时以 null 表示
        await logAdminAction(null, 'login_failed', 'system', null, { email, reason }, clientIp);
      } catch {}
      const msg = error.code === 'ACCOUNT_DISABLED' ? 'Account disabled' : 'Admin account not found';
      return res.status(401).json({ success: false, message: msg });
    }
    console.error('[admin login] error:', error);
    return handleError(error, res, 'Login service unavailable', req);
  }
}
