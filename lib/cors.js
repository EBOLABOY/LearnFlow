// lib/cors.js
// 通用 CORS 助手 (CommonJS)
// 复用 admin CORS 实现

// 直接使用 require
const { applyAdminCors } = require('./admin/cors.js');

// 导出函数
module.exports = {
  applyCors: applyAdminCors
};
