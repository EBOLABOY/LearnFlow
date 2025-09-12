const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDbConnection, handleError, logAdminAction, JWT_SECRET } = require('./middleware');
const { applyAdminCors } = require('./cors');

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

  let connection;
  // Compute client IP robustly
  const clientIp =
    (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null;

  try {
    connection = await getDbConnection();

    // Lookup admin user by email
    const [users] = await connection.execute(
      `SELECT id, email, password_hash, role, is_active, last_login_at 
       FROM users 
       WHERE email = ? AND role = 'admin'`,
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Admin account not found' });
    }

    const user = users[0];

    // Check account status
    if (user.is_active !== 1) {
      return res.status(401).json({ success: false, message: 'Account disabled' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      // Log failed login
      await logAdminAction(
        user.id,
        'login_failed',
        'system',
        null,
        { email, reason: 'invalid_password' },
        clientIp
      );

      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    // Update last login timestamp
    await connection.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

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
    console.error('[admin login] error:', error);
    return handleError(error, res, 'Login service unavailable', req);
  } finally {
    if (connection) connection.release();
  }
}

