const { requireAdmin, getDbConnection, handleError, getPaginationParams, buildSearchQuery } = require('./middleware');
const { applyAdminCors } = require('./cors');

export default async function handler(req, res) {
  // CORS (shared)
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

  const { method } = req;
  switch (method) {
    case 'GET':
      return handleGetUsers(req, res);
    default:
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
}

// List users with filters and pagination
async function handleGetUsers(req, res) {
  let connection;
  try {
    connection = await getDbConnection();

    // Pagination
    const { page, limit, offset } = getPaginationParams(req);

    // Filters
    const searchTerm = req.query.search?.trim();
    const role = req.query.role; // 'user' | 'admin' | undefined
    const status = req.query.status; // 'active' | 'disabled' | undefined

    // Build WHERE
    const whereConditions = [];
    const queryParams = [];
    if (role && ['user', 'admin'].includes(role)) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }
    if (status && ['active', 'disabled'].includes(status)) {
      const activeValue = status === 'active' ? 1 : 0;
      whereConditions.push('is_active = ?');
      queryParams.push(activeValue);
    }
    if (searchTerm) {
      const { whereClause, params } = buildSearchQuery(searchTerm, ['email']);
      whereConditions.push(whereClause.replace('AND ', ''));
      queryParams.push(...params);
    }
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Count
    const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM users ${whereClause}`, queryParams);
    const total = countResult[0].total;

    // Build params in the same order as where conditions
    const mainQueryParams = [];
    if (role && ['user', 'admin'].includes(role)) mainQueryParams.push(role);
    if (status && ['active', 'disabled'].includes(status)) mainQueryParams.push(status === 'active' ? 1 : 0);
    if (searchTerm) mainQueryParams.push(`%${searchTerm}%`);

    // Note: Some MySQL/MariaDB environments do not support placeholders
    // for LIMIT and OFFSET in prepared statements. We intentionally inline
    // validated integers (limit/offset). Values are sanitized in
    // getPaginationParams, preventing SQL injection.
    const [users] = await connection.execute(
      `SELECT 
        id, email, role, is_active, created_at, last_login_at,
        (SELECT COUNT(*) FROM invitation_codes WHERE used_by = users.id) as invitations_used
       FROM users 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      mainQueryParams
    );

    return res.status(200).json({
      success: true,
      data: {
        users: users.map((user) => ({
          ...user,
          status: user.is_active === 1 ? 'active' : 'disabled',
          last_login: user.last_login_at,
          password_hash: undefined,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: offset + limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    return handleError(error, res, 'Failed to get users');
  } finally {
    if (connection) connection.release();
  }
}
