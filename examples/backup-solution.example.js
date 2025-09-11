/**
 * Example only — do not run in production.
 *
 * This snippet demonstrates an alternative approach to building the
 * invitations listing query for debugging purposes. If you need to
 * experiment locally, copy parts into a separate sandbox and review
 * carefully before use.
 */

// Base WHERE with optional conditions
const baseWhereClause = 'WHERE 1=1';
let additionalConditions = [];
let queryParams = [];

// Status filter
if (status && ['active', 'used', 'expired', 'revoked'].includes(status)) {
  if (status === 'active') {
    additionalConditions.push('AND used_by IS NULL AND expires_at > NOW()');
  } else if (status === 'used') {
    additionalConditions.push('AND used_by IS NOT NULL');
  } else if (status === 'expired') {
    additionalConditions.push('AND used_by IS NULL AND expires_at <= NOW()');
  }
}

// Search filter
if (searchTerm) {
  additionalConditions.push('AND code LIKE ?');
  queryParams.push(`%${searchTerm}%`);
}

const whereClause = `${baseWhereClause} ${additionalConditions.join(' ')}`.trim();

// Inline LIMIT/OFFSET as validated integers
const limitInt = parseInt(limit, 10);
const offsetInt = parseInt(offset, 10);

const query = `
  SELECT
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
  LIMIT ${limitInt} OFFSET ${offsetInt}
`;

// Execute with or without parameters
const [rows] = queryParams.length > 0
  ? await connection.execute(query, queryParams)
  : await connection.execute(query);

console.log('Example rows length:', rows.length);

