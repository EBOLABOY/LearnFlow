const { requireAdmin, handleError } = require('./middleware');
const { applyAdminCors } = require('./cors');

export default async function handler(req, res) {
  // CORS (shared implementation)
  applyAdminCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Admin auth
  try {
    await new Promise((resolve, reject) => {
      requireAdmin(req, res, (error) => (error ? reject(error) : resolve()));
    });
  } catch (error) {
    return; // middleware already responded
  }

  try {
    // Return admin profile (already authenticated)
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        lastLogin: req.user.last_login_at,
        status: req.user.is_active === 1 ? 'active' : 'disabled',
      },
    });
  } catch (error) {
    console.error('[admin profile] error:', error);
    return handleError(error, res, 'Failed to get admin profile');
  }
}

