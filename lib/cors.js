// 通用 CORS 助手（ESM）
// 复用 admin CORS 实现，统一跨域行为，避免各 API 手工设置头部
// 注意：此文件需使用 UTF-8 编码

import applyAdminCorsDefault, { applyAdminCors as _applyAdminCors } from './admin/cors.js';

// 兼容命名/默认两种导出形式
const _impl = _applyAdminCors || applyAdminCorsDefault;

export function applyCors(req, res) {
  _impl(req, res);
}

export default applyCors;

