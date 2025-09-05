[根目录](../CLAUDE.md) > **content**

# 内容脚本加载器

## 变更记录 (Changelog)

### 2025年09月05日 8:18:15 - 模块文档创建
- 创建内容脚本加载器模块文档
- 分析站点检测和模块加载机制
- 记录权限管理和安全控制逻辑

---

## 模块职责

内容脚本加载器是深学助手扩展的启动入口，负责在匹配的网页中检测当前站点、查询用户配置、并启动相应的站点自动化模块。该模块作为扩展沙箱环境与页面内容之间的桥梁。

## 入口与启动

### 主入口文件：`loader.js`
- **执行环境**: 内容脚本沙箱（Content Script）
- **注入时机**: `document_idle`（DOM加载完成后）
- **权限范围**: 可访问DOM，可使用扩展API，但无法访问页面JavaScript变量

### 启动时机判断
```javascript
// DOM就绪检查
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  run();
} else {
  document.addEventListener('DOMContentLoaded', run);
}
```

## 对外接口

### 与扩展后台通信
- **Chrome Storage Sync API**: 读取用户配置的站点开关状态
- **站点注册器集成**: 使用`DeepLearn.registry.resolve()`匹配当前站点

### 配置数据格式
```javascript
// Chrome Storage中的配置结构
{
  enabledSites: {
    'www.0755tt.com': true,  // 启用状态
    'other-site.com': false  // 禁用状态  
  }
}
```

## 关键依赖与配置

### 扩展API依赖
- `chrome.storage.sync.get()`: 读取同步存储配置
- 需要在manifest.json中声明`storage`权限

### 模块依赖
- `DeepLearn.registry`: 站点注册器（由registry.js提供）
- 依赖src/目录下所有脚本的预先加载

### 执行顺序要求
根据manifest.json的content_scripts配置，loader.js必须最后加载：
```json
"js": [
  "src/util.js",
  "src/bank.js", 
  "src/registry.js",
  "src/sites/0755tt/questionBank.js",
  "src/sites/0755tt/video.js",
  "src/sites/0755tt/exam.js",
  "src/sites/0755tt/index.js",
  "content/loader.js"  // 最后加载
]
```

## 数据模型

### 站点匹配流程
1. 获取当前页面location对象
2. 调用registry.resolve(location)查找匹配站点
3. 从Chrome Storage读取该站点的启用状态
4. 如果启用则调用站点的init()方法

### 错误处理策略
```javascript
// 安全执行站点初始化
try { 
  site.init(); 
} catch (e) { 
  console.error('[深学助手] 初始化失败', e); 
}
```

## 测试与质量

### 关键测试场景
1. **站点匹配测试**: 验证不同域名和URL路径的匹配准确性
2. **配置读取测试**: 测试Storage API异常情况的处理
3. **权限验证测试**: 确认在不同站点的权限正常工作
4. **初始化异常测试**: 验证站点模块init()失败时的错误处理

### 安全性考虑
- **权限最小化**: 仅在匹配的域名注入内容脚本
- **配置验证**: 检查Storage数据的有效性
- **异常隔离**: 单个站点模块错误不影响整体功能

### 代码质量特点
- ✅ 简洁的单一职责设计
- ✅ 完整的异常处理机制
- ✅ 清晰的执行流程控制
- ✅ 安全的Storage访问模式
- ❌ 缺少重试机制
- ❌ 无性能监控

## 常见问题 (FAQ)

### Q: 为什么要检查站点启用状态？
A: 为了给用户提供细粒度控制，允许用户在选项页面中选择性启用或禁用特定站点的自动化功能。

### Q: 如果Storage读取失败会怎样？
A: 会使用默认的空对象`{}`，此时所有站点都被视为启用状态（除非明确设置为false）。

### Q: loader.js必须最后加载的原因？
A: 确保所有依赖模块（工具函数、注册器、站点模块）都已经注册完毕，loader才开始执行站点匹配和启动逻辑。

### Q: 内容脚本权限有什么限制？
A: 内容脚本运行在沙箱环境中，无法访问页面的JavaScript变量和函数，需要通过DOM操作或消息传递与页面交互。

## 相关文件清单

```
content/
└── loader.js         # 内容脚本加载器（唯一文件）
```

### 依赖关系
```
loader.js 依赖：
├── src/registry.js    # 站点注册器
├── src/util.js        # 工具函数（日志记录）
└── chrome.storage     # 扩展存储API

被依赖关系：
├── manifest.json      # 声明为content_script
└── 所有站点模块        # 通过init()方法启动
```

## 变更记录 (Changelog)

### 当前版本特性
- 支持基于URL的智能站点匹配
- 集成用户配置的站点开关控制
- 提供异常安全的模块启动机制
- 实现简洁的执行流程管理
- 建立扩展与页面的通信桥梁