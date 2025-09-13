const { requireAdmin, getDbConnection, handleError, logAdminAction } = require('../../../lib/admin/middleware.js');
const { applyAdminCors } = require('../../../lib/admin/cors.js');

export default async function handler(req, res) {
  // CORS
  applyAdminCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Admin auth
  try {
    await new Promise((resolve, reject) => {
      requireAdmin(req, res, (error) => (error ? reject(error) : resolve()));
    });
  } catch (error) {
    return; // middleware already responded
  }

  const { method, query } = req;
  const userId = query.id || query.userId || query.slug || query[0] || query?.id;

  switch (method) {
    case 'GET':
      return getUser(userId, req, res);
    case 'PUT':
      return updateUser(userId, req, res);
    default:
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}

async function getUser(userId, req, res) {
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }
  let connection;
  try {
    connection = await getDbConnection();
    const [rows] = await connection.execute(
      'SELECT id, email, role, is_active, created_at, last_login_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.is_active === 1 ? 'active' : 'disabled',
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
    });
  } catch (error) {
    return handleError(error, res, 'Failed to get user', req);
  } finally {
    if (connection) connection.release();
  }
}

async function updateUser(userId, req, res) {
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }
  const { status, role } = req.body || {};
  if (status && !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid user status' });
  }
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid user role' });
  }

  let connection;
  try {
    connection = await getDbConnection();

    const [existingUsers] = await connection.execute(
      'SELECT id, email, role, is_active FROM users WHERE id = ?',
      [userId]
    );
    if (!existingUsers.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const existingUser = existingUsers[0];

    if (String(userId) === String(req.user.id) && status === 'disabled') {
      return res.status(400).json({ success: false, message: 'Cannot disable your own account' });
    }

    if (existingUser.role === 'admin' && role === 'user') {
      const [adminCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1 AND id != ?',
        [userId]
      );
      if (adminCount[0].count === 0) {
        return res.status(400).json({ success: false, message: 'At least one active admin is required' });
      }
    }

    const updateFields = [];
    const updateParams = [];
    if (status !== undefined) {
      updateFields.push('is_active = ?');
      updateParams.push(status === 'active' ? 1 : 0);
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      updateParams.push(role);
    }
    if (!updateFields.length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updateParams.push(userId);
    await connection.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

    await logAdminAction(
      req.adminId,
      'update_user',
      'user',
      parseInt(userId, 10),
      { previous: existingUser, changes: { status, role } },
      req.clientIp
    );

    return res.status(200).json({ success: true, message: 'User updated' });
  } catch (error) {
    return handleError(error, res, 'Failed to update user', req);
  } finally {
    if (connection) connection.release();
  }
}
