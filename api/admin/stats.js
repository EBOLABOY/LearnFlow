const { requireAdmin, getDbConnection, handleError } = require('../../lib/admin/middleware.js');
const { applyAdminCors } = require('../../lib/admin/cors.js');

module.exports = async function handler(req, res) {
  // CORS (shared)
  applyAdminCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
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

  let connection;

  try {
    connection = await getDbConnection();

    // 并发查询各种统计数据
    const [
      userStats,
      invitationStats,
      dailyRegistrations,
      recentActivity
    ] = await Promise.all([
      getUserStats(connection),
      getInvitationStats(connection),
      getDailyRegistrations(connection),
      getRecentActivity(connection)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users: userStats,
        invitations: invitationStats,
        registrations: dailyRegistrations,
        activity: recentActivity,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[系统统计] 错误:', error);
    return handleError(error, res, '获取系统统计失败');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 用户统计
async function getUserStats(connection) {
  const [results] = await connection.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as users,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as disabled,
      SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as newThisWeek,
      SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as newThisMonth,
      SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as activeThisWeek
    FROM users
  `);

  return results[0];
}

// 邀请码统计
async function getInvitationStats(connection) {
  const [results] = await connection.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN used_by IS NULL AND expires_at > NOW() THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN used_by IS NOT NULL THEN 1 ELSE 0 END) as used,
      SUM(CASE WHEN used_by IS NULL AND expires_at <= NOW() THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as createdThisWeek,
      SUM(CASE WHEN used_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as usedThisWeek
    FROM invitation_codes
  `);

  return results[0];
}

// 每日注册统计（最近30天）
async function getDailyRegistrations(connection) {
  const [results] = await connection.execute(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
    FROM users 
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `);

  return results;
}

// 最近活动
async function getRecentActivity(connection) {
  const [adminLogs] = await connection.execute(`
    SELECT 
      al.action,
      al.target_type,
      al.created_at,
      u.email as admin_email,
      al.details
    FROM admin_logs al
    JOIN users u ON al.admin_id = u.id
    ORDER BY al.created_at DESC
    LIMIT 20
  `);

  const [recentUsers] = await connection.execute(`
    SELECT 
      email,
      role,
      created_at,
      last_login_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const [recentInvitations] = await connection.execute(`
    SELECT 
      ic.code,
      ic.created_at,
      ic.used_at,
      creator.email as created_by,
      user.email as used_by
    FROM invitation_codes ic
    LEFT JOIN users creator ON ic.created_by = creator.id
    LEFT JOIN users user ON ic.used_by = user.id
    ORDER BY ic.created_at DESC
    LIMIT 10
  `);

  return {
    adminLogs,
    recentUsers,
    recentInvitations
  };
}
