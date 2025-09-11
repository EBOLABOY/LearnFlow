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
    return; // already responded
  }

  const { method, query } = req;
  const invitationId = query.id || query.invitationId || query.slug || query[0] || query?.id;

  switch (method) {
    case 'DELETE':
      return revoke(invitationId, req, res);
    default:
      return res.status(405).json({ success: false, message: '方法不被允许' });
  }
}

async function revoke(invitationId, req, res) {
  if (!invitationId) {
    return res.status(400).json({ success: false, message: '邀请码ID不能为空' });
  }
  let connection;
  try {
    connection = await getDbConnection();

    const [rows] = await connection.execute(
      'SELECT id, code, used_by, expires_at FROM invitation_codes WHERE id = ?',
      [invitationId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: '邀请码不存在' });
    }
    const invitation = rows[0];
    if (invitation.used_by) {
      return res.status(400).json({ success: false, message: '已使用的邀请码无法撤销' });
    }

    await connection.execute('DELETE FROM invitation_codes WHERE id = ?', [invitationId]);

    await logAdminAction(
      req.adminId,
      'revoke_invitation',
      'invitation_code',
      parseInt(invitationId, 10),
      { code: invitation.code, wasExpired: new Date(invitation.expires_at) < new Date() },
      req.clientIp
    );

    return res.status(200).json({ success: true, message: '邀请码撤销成功' });
  } catch (error) {
    return handleError(error, res, '撤销邀请码失败', req);
  } finally {
    if (connection) connection.release();
  }
}

