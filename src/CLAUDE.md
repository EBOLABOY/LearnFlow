[根目录](../CLAUDE.md) > **src**

# 核心功能模块

## 变更记录 (Changelog)

### 2025年09月05日 8:18:15 - 模块文档创建
- 创建核心功能模块文档
- 分析工具函数、注册器和银行管理功能
- 建立模块间依赖关系文档

---

## 模块职责

核心功能模块提供深学助手扩展的基础设施服务，包括通用工具函数、站点注册管理、存储管理等核心能力。该模块为所有站点适配模块提供统一的API接口和工具支持。

## 入口与启动

### 主要入口文件
- **`util.js`**: 工具函数库，提供DOM操作、存储管理、日志记录等基础功能
- **`registry.js`**: 站点注册器，管理多站点模块的注册和解析
- **`bank.js`**: 数据管理模块（当前项目中暂未使用）

### 加载顺序
根据`manifest.json`中的content_scripts配置：
1. `util.js` - 首先加载，初始化全局工具函数
2. `bank.js` - 数据管理功能
3. `registry.js` - 站点注册器
4. 站点特定模块（如questionBank.js、video.js等）
5. `content/loader.js` - 最后加载，启动站点匹配

## 对外接口

### 全局命名空间：`window.DeepLearn`
```javascript
window.DeepLearn = {
  util: {}, // 工具函数集合
  registry: {}, // 站点注册器
  sites: {} // 站点特定命名空间
};
```

### 核心API接口

#### 工具函数 (util.js)
- `randomDelay(min, max)`: 生成随机延迟时间
- `simulateClick(element)`: 模拟鼠标点击事件
- `getUrlParameter(name)`: 获取URL参数
- `waitForElement(selector, timeout)`: 等待DOM元素出现
- `safeExecute(fn, context, defaultValue)`: 安全执行函数
- `log/logInfo/logWarn/logError`: 结构化日志记录
- `throttle/debounce`: 函数防抖节流
- `isElementVisible(element)`: 检查元素可见性
- `scrollIntoView(element, options)`: 滚动元素到视图

#### 存储管理 (util.storage)
- `get(key, defaultValue)`: 从localStorage读取数据
- `set(key, value)`: 向localStorage写入数据  
- `remove(key)`: 从localStorage删除数据

#### 性能监控 (util.performance)
- `start(label)`: 开始性能计时
- `end(label)`: 结束性能计时并输出结果

#### 站点注册器 (registry.js)
- `register(site)`: 注册站点模块
- `resolve(location)`: 根据location解析匹配的站点
- `sites[]`: 已注册站点列表

## 关键依赖与配置

### 浏览器API依赖
- `localStorage`: 本地存储API
- `performance`: 性能监控API  
- `MutationObserver`: DOM变化监听
- `MouseEvent`: 鼠标事件构造

### 配置要求
- 需要在content_scripts中最早加载
- 需要访问页面DOM的权限
- 需要localStorage访问权限

## 数据模型

### 站点注册对象结构
```javascript
{
  id: 'www.example.com',        // 站点唯一标识
  name: '站点显示名称',          // 人类可读名称
  matches(location) { ... },    // 匹配函数
  init() { ... }               // 初始化函数
}
```

### 存储数据格式
```javascript
// localStorage中的数据都使用 DeepLearn_ 前缀
// 存储格式为JSON字符串
{
  "DeepLearn_configKey": "serializedValue",
  "DeepLearn_userPrefs": "{\"site1\":true,\"site2\":false}"
}
```

### 日志格式
```javascript
// 统一的日志前缀格式
"[深学助手 HH:MM:SS] 日志内容"

// 错误上下文格式
{
  context: "操作描述",
  error: ErrorObject,
  timestamp: Date
}
```

## 测试与质量

### 工具函数测试
- **DOM操作测试**: 验证元素查找、点击模拟、滚动控制
- **异步工具测试**: 测试waitForElement的超时和成功场景
- **存储管理测试**: 验证读写删操作和错误处理
- **性能监控测试**: 检查计时准确性和内存泄漏

### 注册器测试  
- **站点注册测试**: 验证多站点注册和去重
- **匹配逻辑测试**: 测试各种URL格式的匹配准确性
- **解析性能测试**: 验证大量站点时的解析速度

### 代码质量特点
- ✅ 完整的错误处理和兜底逻辑
- ✅ 统一的日志格式和错误上下文
- ✅ 内存泄漏防护（如超时清理）
- ✅ 函数式编程风格，避免全局污染
- ❌ 缺少TypeScript类型定义
- ❌ 缺少单元测试覆盖

## 常见问题 (FAQ)

### Q: 为什么使用IIFE模式包装代码？
A: 避免全局命名空间污染，确保变量作用域隔离，同时通过`window.DeepLearn`提供统一的API接口。

### Q: localStorage存储失败如何处理？
A: 使用`util.safeExecute`包装存储操作，失败时返回默认值并记录错误日志，不会中断程序执行。

### Q: 如何添加新的工具函数？
A: 在`util.js`的命名空间中添加新函数，遵循现有的错误处理和日志记录模式。

### Q: 站点注册的匹配优先级如何确定？
A: 按注册顺序匹配，first-match原则。建议将更具体的域名模式优先注册。

## 相关文件清单

```
src/
├── util.js           # 工具函数库（核心）
├── registry.js       # 站点注册器（核心）
├── bank.js          # 数据管理模块（预留）
└── sites/           # 站点适配模块目录
    └── 0755tt/      # 0755TT站点模块
```

### 被依赖的文件
- `content/loader.js`: 使用registry解析站点
- `src/sites/*/`: 各站点模块使用util工具函数
- `background.js`: 可能使用相同的工具函数

## 变更记录 (Changelog)

### 当前版本特性
- 提供完整的DOM操作工具集
- 实现统一的存储管理接口
- 支持站点模块的动态注册
- 提供性能监控和错误处理
- 建立结构化的日志体系