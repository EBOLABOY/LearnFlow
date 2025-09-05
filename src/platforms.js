// src/platforms.js - 标准 ES 模块版本
// 专为 Manifest V3 Service Worker 设计，完全符合现代 JavaScript 模块标准

/**
 * 平台定义配置 - 导出为模块
 * 每个平台包含唯一ID、显示名称、域名列表和图标
 * 在UI层面将相关域名归组，保持后端逻辑精确性
 * 新增平台时，只需在此处添加配置，无需修改其他文件
 */
export const PLATFORM_DEFINITIONS = {
  '0755tt': {
    id: '0755tt',
    name: '0755TT智慧职教',
    domains: ['www.0755tt.com'],
    description: '深圳职业技术大学智慧职教平台',
    icon: '🎓'
  },
  'smartedu': {
    id: 'smartedu', 
    name: '国家智慧教育平台',
    domains: [
      'www.smartedu.cn',
      'basic.smartedu.cn',
      'smartedu.gdtextbook.com', 
      'teacher.ykt.eduyun.cn'
    ],
    description: '包含国家智慧教育平台、中小学智慧平台、教师平台等多个子平台',
    icon: '🌐'
  }
};

/**
 * 通过域名查找对应的平台
 * @param {string} domain - 域名
 * @returns {Object|null} 平台对象或null
 */
export function getPlatformByDomain(domain) {
  for (const platformId in PLATFORM_DEFINITIONS) {
    const platform = PLATFORM_DEFINITIONS[platformId];
    if (platform.domains.includes(domain)) {
      return platform;
    }
  }
  return null;
}

/**
 * 获取所有支持的域名列表
 * @returns {Array} 域名数组
 */
export function getAllSupportedDomains() {
  return Object.values(PLATFORM_DEFINITIONS)
    .flatMap(platform => platform.domains);
}

/**
 * 检查域名是否被支持
 * @param {string} domain - 域名
 * @returns {boolean} 是否支持
 */
export function isSiteSupported(domain) {
  return getPlatformByDomain(domain) !== null;
}