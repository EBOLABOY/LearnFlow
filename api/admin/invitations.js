const { requireAdmin, getDbConnection, handleError, logAdminAction, getPaginationParams, buildSearchQuery, getSortParams } = require('../../lib/admin/middleware.js');
const { applyAdminCors } = require('../../lib/admin/cors.js');

module.exports = async function handler(req, res) {
  // Apply shared CORS
  applyAdminCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGetInvitations(req, res);
    case 'POST':
      return handleCreateInvitations(req, res);
    default:
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}

// 获取邀请码列表
async function handleGetInvitations(req, res) {
  let connection;
  
  try {
    connection = await getDbConnection();
    
    // 分页参数
    const { page, limit, offset } = getPaginationParams(req);
    
    // 筛选参数
    const status = req.query.status; // 'active', 'used', 'expired', 'revoked'
    const searchTerm = req.query.search?.trim();
    
    // 构建查询条件
    let whereConditions = [];
    let queryParams = [];
    
    // 状态筛选
    if (status && ['active', 'used', 'expired', 'revoked'].includes(status)) {
      if (status === 'active') {
        whereConditions.push('used_by IS NULL AND expires_at > NOW()');
      } else if (status === 'used') {
        whereConditions.push('used_by IS NOT NULL');
      } else if (status === 'expired') {
        whereConditions.push('used_by IS NULL AND expires_at <= NOW()');
      }
    }
    
    // 搜索条件（邀请码本身）
    if (searchTerm) {
      whereConditions.push('code LIKE ?');
      queryParams.push(`%${searchTerm}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // 查询邀请码总数
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM invitation_codes ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;
    
    // 查询邀请码列表
    // 明确构建参数数组，确保参数顺序和数量正确
    const mainQueryParams = [];
    
    // 添加WHERE条件的参数（按照whereConditions的顺序）
    if (searchTerm) {
      mainQueryParams.push(`%${searchTerm}%`);
    }
    
    // 注意：部分 MySQL/MariaDB 环境不支持在预处理语句中为 LIMIT/OFFSET 使用占位符
    // 因此将经过校验的整数 limit/offset 直接内联到 SQL 中，避免 ER_WRONG_ARGUMENTS 错误
    
    
    // Note: Some MySQL/MariaDB environments do not support placeholders for
    // LIMIT and OFFSET in prepared statements. We intentionally inline
    // validated integers (limit/offset). Values are sanitized in
    // getPaginationParams, preventing SQL injection.
    // 排序（白名单）
    const allowedSort = {
      code: 'ic.code',
      created_at: 'ic.created_at',
      expires_at: 'ic.expires_at',
      used_at: 'ic.used_at',
      created_by_email: 'creator.email',
      used_by_email: 'user.email',
    };
    const { clause: sortClause } = getSortParams(req, allowedSort, 'created_at', 'DESC');

    const [invitations] = await connection.execute(
      `SELECT 
        ic.id, ic.code, ic.expires_at, ic.created_at, ic.used_at,
        CASE
          WHEN ic.used_by IS NOT NULL THEN 'used'
          WHEN ic.expires_at < NOW() THEN 'expired'
          ELSE 'active'
        END AS status,
        creator.email as created_by_email,
        user.email as used_by_email
       FROM invitation_codes ic
       LEFT JOIN users creator ON ic.created_by = creator.id
       LEFT JOIN users user ON ic.used_by = user.id
       ${whereClause}
       ${sortClause || 'ORDER BY ic.created_at DESC'} 
       LIMIT ${limit} OFFSET ${offset}`,
      mainQueryParams
    );

    return res.status(200).json({
      success: true,
      data: {
        invitations,
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
    console.error('[邀请码列表] 错误:', error);
    return handleError(error, res, '获取邀请码列表失败');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 创建邀请码
async function handleCreateInvitations(req, res) {
  const { count = 1, expiryDays = 30 } = req.body;

  // 验证参数
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return res.status(400).json({
      success: false,
      message: '邀请码数量必须是1-100之间的整数'
    });
  }

  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365) {
    return res.status(400).json({
      success: false,
      message: '有效期必须是1-365天之间的整数'
    });
  }

  let connection;

  try {
    connection = await getDbConnection();
    await connection.beginTransaction();

    const createdCodes = [];

    for (let i = 0; i < count; i++) {
      // 生成唯一邀请码
      let code;
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        code = generateInviteCode();
        
        // 检查是否唯一
        const [existing] = await connection.execute(
          'SELECT id FROM invitation_codes WHERE code = ?',
          [code]
        );
        
        isUnique = existing.length === 0;
        attempts++;
      }

      if (!isUnique) {
        throw new Error('生成邀请码失败，请重试');
      }

      // 插入邀请码
      const [result] = await connection.execute(
        `INSERT INTO invitation_codes (code, created_by, expires_at) 
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [code, req.adminId, expiryDays]
      );

      createdCodes.push({
        id: result.insertId,
        code,
        expiryDays
      });
    }

    await connection.commit();

    // 记录管理员操作
    await logAdminAction(
      req.adminId,
      'create_invitations',
      'invitation_code',
      null,
      { 
        count, 
        expiryDays,
        codes: createdCodes.map(c => c.code) 
      },
      req.clientIp
    );

    return res.status(201).json({
      success: true,
      message: `成功创建${count}个邀请码`,
      data: {
        codes: createdCodes,
        count: createdCodes.length
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('[创建邀请码] 错误:', error);
    return handleError(error, res, '创建邀请码失败');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 生成邀请码辅助函数
function generateInviteCode(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
