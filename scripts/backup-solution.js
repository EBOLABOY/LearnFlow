// 如果调试显示问题仍然存在，可以尝试这个更简单的方法

// 在invitations.js中替换有问题的查询为更简单的形式：

// 方法1: 不使用动态WHERE，而是始终包含WHERE 1=1
const baseWhereClause = 'WHERE 1=1';
let additionalConditions = [];
let queryParams = [];

// 状态筛选
if (status && ['active', 'used', 'expired', 'revoked'].includes(status)) {
  if (status === 'active') {
    additionalConditions.push('AND used_by IS NULL AND expires_at > NOW()');
  } else if (status === 'used') {
    additionalConditions.push('AND used_by IS NOT NULL');
  } else if (status === 'expired') {
    additionalConditions.push('AND used_by IS NULL AND expires_at <= NOW()');
  }
}

// 搜索条件
if (searchTerm) {
  additionalConditions.push('AND code LIKE ?');
  queryParams.push(`%${searchTerm}%`);
}

const whereClause = baseWhereClause + additionalConditions.join(' ');

// 方法2: 使用简单的字符串拼接而不是参数绑定
const limitStr = parseInt(limit);
const offsetStr = parseInt(offset);

const query = `SELECT 
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
 ORDER BY ic.created_at DESC 
 LIMIT ${limitStr} OFFSET ${offsetStr}`;

// 如果有参数，使用参数绑定；如果没有参数，不传递参数数组
const [invitations] = queryParams.length > 0 
  ? await connection.execute(query, queryParams)
  : await connection.execute(query);