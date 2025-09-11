const { requireAdmin, getDbConnection, handleError, logAdminAction, getPaginationParams, buildSearchQuery } = require('./middleware');

export default async function handler(req, res) {
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

  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGetUsers(req, res);
    case 'PUT':
      return handleUpdateUser(req, res);
    case 'DELETE':
      return handleDeleteUser(req, res);
    default:
      return res.status(405).json({
        success: false,
        message: '方法不被允许'
      });
  }
}

// 获取用户列表
async function handleGetUsers(req, res) {
  let connection;
  
  try {
    connection = await getDbConnection();
    
    // 分页参数
    const { page, limit, offset } = getPaginationParams(req);
    
    // 搜索参数
    const searchTerm = req.query.search?.trim();
    const role = req.query.role; // 'user', 'admin', 或 undefined（全部）
    const status = req.query.status; // 'active', 'disabled', 或 undefined（全部）
    
    // 构建查询条件
    let whereConditions = [];
    let queryParams = [];
    
    // 角色筛选
    if (role && ['user', 'admin'].includes(role)) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }
    
    // 状态筛选
    if (status && ['active', 'disabled'].includes(status)) {
      const activeValue = status === 'active' ? 1 : 0;
      whereConditions.push('is_active = ?');
      queryParams.push(activeValue);
    }
    
    // 搜索条件
    if (searchTerm) {
      const { whereClause, params } = buildSearchQuery(searchTerm, ['email']);
      whereConditions.push(whereClause.replace('AND ', ''));
      queryParams.push(...params);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // 查询用户总数
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;
    
    // 查询用户列表
    const [users] = await connection.execute(
      `SELECT 
        id, email, role, is_active, created_at, updated_at, last_login_at,
        (SELECT COUNT(*) FROM invitation_codes WHERE used_by = users.id) as invitations_used
       FROM users 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        users: users.map(user => ({
          ...user,
          status: user.is_active === 1 ? 'active' : 'disabled', // 转换为前端期望的格式
          last_login: user.last_login_at, // 转换字段名为前端期望的格式
          password_hash: undefined // 移除敏感信息
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: offset + limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('[用户列表] 错误:', error);
    return handleError(error, res, '获取用户列表失败');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 更新用户信息
async function handleUpdateUser(req, res) {
  const userId = req.query.id || req.body.id;
  const { status, role } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: '用户ID不能为空'
    });
  }

  // 验证更新参数
  if (status && !['active', 'disabled'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: '无效的用户状态'
    });
  }

  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: '无效的用户角色'
    });
  }

  let connection;

  try {
    connection = await getDbConnection();

    // 检查用户是否存在
    const [existingUsers] = await connection.execute(
      'SELECT id, email, role, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const existingUser = existingUsers[0];

    // 防止管理员误操作：不能禁用自己的账户
    if (userId == req.user.id && status === 'disabled') {
      return res.status(400).json({
        success: false,
        message: '不能禁用自己的账户'
      });
    }

    // 防止降级最后一个管理员
    if (existingUser.role === 'admin' && role === 'user') {
      const [adminCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1 AND id != ?',
        [userId]
      );
      
      if (adminCount[0].count === 0) {
        return res.status(400).json({
          success: false,
          message: '至少需要保留一个管理员账户'
        });
      }
    }

    // 构建更新查询
    const updateFields = [];
    const updateParams = [];

    if (status !== undefined) {
      const activeValue = status === 'active' ? 1 : 0;
      updateFields.push('is_active = ?');
      updateParams.push(activeValue);
    }

    if (role !== undefined) {
      updateFields.push('role = ?');
      updateParams.push(role);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有要更新的字段'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateParams.push(userId);

    // 执行更新
    await connection.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // 记录管理员操作
    await logAdminAction(
      req.adminId,
      'update_user',
      'user',
      parseInt(userId),
      { 
        previous: existingUser, 
        changes: { status, role }
      },
      req.clientIp
    );

    return res.status(200).json({
      success: true,
      message: '用户信息更新成功'
    });

  } catch (error) {
    console.error('[更新用户] 错误:', error);
    return handleError(error, res, '更新用户信息失败');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 删除用户（软删除：设置状态为disabled）
async function handleDeleteUser(req, res) {
  const userId = req.query.id;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: '用户ID不能为空'
    });
  }

  // 防止删除自己
  if (userId == req.user.id) {
    return res.status(400).json({
      success: false,
      message: '不能删除自己的账户'
    });
  }

  let connection;

  try {
    connection = await getDbConnection();

    // 检查用户是否存在
    const [existingUsers] = await connection.execute(
      'SELECT id, email, role FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = existingUsers[0];

    // 防止删除最后一个管理员
    if (user.role === 'admin') {
      const [adminCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1 AND id != ?',
        [userId]
      );
      
      if (adminCount[0].count === 0) {
        return res.status(400).json({
          success: false,
          message: '不能删除最后一个管理员账户'
        });
      }
    }

    // 软删除：设置状态为disabled
    await connection.execute(
      'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [userId]
    );

    // 撤销该用户创建的未使用邀请码
    await connection.execute(
      'UPDATE invitation_codes SET status = "revoked" WHERE created_by = ? AND used_by IS NULL',
      [userId]
    );

    // 记录管理员操作
    await logAdminAction(
      req.adminId,
      'delete_user',
      'user',
      parseInt(userId),
      { deletedUser: user },
      req.clientIp
    );

    return res.status(200).json({
      success: true,
      message: '用户删除成功'
    });

  } catch (error) {
    console.error('[删除用户] 错误:', error);
    return handleError(error, res, '删除用户失败');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}