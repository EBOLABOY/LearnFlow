// Shared CORS helper for admin APIs
// Supports comma-separated whitelist in CORS_ORIGIN and falls back safely.

function resolveAllowedOrigin(reqOrigin, corsEnv) {
  let allowOrigin = corsEnv || '';

  if (!corsEnv || corsEnv === '') {
    return reqOrigin || '*';
  }

  // When credentials are true, the server MUST respond with the specific request origin, not a wildcard.
  if (corsEnv === '*') {
    return reqOrigin || '*';
  }

  // Comma-separated whitelist support
  if (reqOrigin && corsEnv.includes(',')) {
    const whitelist = corsEnv.split(',').map((o) => o.trim()).filter(Boolean);
    if (whitelist.includes(reqOrigin)) return reqOrigin;
    // Fallback to first valid entry when request origin is not in list
    if (whitelist.length > 0) return whitelist[0];
  }

  return allowOrigin;
}

export function applyAdminCors(req, res) {
  const corsEnv = process.env.CORS_ORIGIN || 'https://learn-flow-a2jt.vercel.app';
  const requestOrigin = req.headers.origin;
  const allowOrigin = resolveAllowedOrigin(requestOrigin, corsEnv);

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Ensure caches/proxies vary by Origin
  res.setHeader('Vary', 'Origin');
}

export default applyAdminCors;

