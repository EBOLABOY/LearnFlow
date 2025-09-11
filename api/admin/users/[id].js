const { requireAdmin, getDbConnection, handleError, logAdminAction } = require('../middleware');

export default async function handler(req, res) {
  // CORS
  const allowedOrigin = process.env.CORS_ORIGIN || 'https://learn-flow-a2jt.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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
    case 'DELETE':
      return deleteUser(userId, req, res);
    default:
      return res.status(405).json({ success: false, message: '方法不被允许' });
  }
}

async function getUser(userId, req, res) {
  if (!userId) {
    return res.status(400).json({ success: false, message: '用户ID不能为空' });
  }
  let connection;
  try {
    connection = await getDbConnection();
    const [rows] = await connection.execute(
      'SELECT id, email, role, is_active, created_at, last_login_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: '用户不存在' });
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
    return handleError(error, res, '获取用户失败', req);
  } finally {
    if (connection) connection.release();
  }
}

async function updateUser(userId, req, res) {
  if (!userId) {
    return res.status(400).json({ success: false, message: '用户ID不能为空' });
  }
  const { status, role } = req.body || {};
  if (status && !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ success: false, message: '无效的用户状态' });
  }
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: '无效的用户角色' });
  }

  let connection;
  try {
    connection = await getDbConnection();

    const [existingUsers] = await connection.execute(
      'SELECT id, email, role, is_active FROM users WHERE id = ?',
      [userId]
    );
    if (!existingUsers.length) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    const existingUser = existingUsers[0];

    if (String(userId) == String(req.user.id) && status === 'disabled') {
      return res.status(400).json({ success: false, message: '不能禁用自己的账户' });
    }

    if (existingUser.role === 'admin' && role === 'user') {
      const [adminCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1 AND id != ?',
        [userId]
      );
      if (adminCount[0].count === 0) {
        return res.status(400).json({ success: false, message: '至少需要保留一个管理员账户' });
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
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
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

    return res.status(200).json({ success: true, message: '用户信息更新成功' });
  } catch (error) {
    return handleError(error, res, '更新用户信息失败', req);
  } finally {
    if (connection) connection.release();
  }
}

async function deleteUser(userId, req, res) {
  if (!userId) {
    return res.status(400).json({ success: false, message: '用户ID不能为空' });
  }
  if (String(userId) == String(req.user.id)) {
    return res.status(400).json({ success: false, message: '不能删除自己的账户' });
  }
  let connection;
  try {
    connection = await getDbConnection();

    const [existingUsers] = await connection.execute(
      'SELECT id, email, role FROM users WHERE id = ?',
      [userId]
    );
    if (!existingUsers.length) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    const user = existingUsers[0];

    if (user.role === 'admin') {
      const [adminCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1 AND id != ?',
        [userId]
      );
      if (adminCount[0].count === 0) {
        return res.status(400).json({ success: false, message: '不能删除最后一个管理员账户' });
      }
    }

    await connection.execute('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
    await connection.execute(
      'DELETE FROM invitation_codes WHERE created_by = ? AND used_by IS NULL',
      [userId]
    );

    await logAdminAction(
      req.adminId,
      'delete_user',
      'user',
      parseInt(userId, 10),
      { deletedUser: user },
      req.clientIp
    );

    return res.status(200).json({ success: true, message: '用户删除成功' });
  } catch (error) {
    return handleError(error, res, '删除用户失败', req);
  } finally {
    if (connection) connection.release();
  }
}

