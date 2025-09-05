[根目录](../CLAUDE.md) > **options**

# 扩展选项页面

## 变更记录 (Changelog)

### 2025年09月05日 8:18:15 - 模块文档创建
- 创建扩展选项页面模块文档
- 分析用户界面和配置管理功能
- 记录存储同步和交互逻辑

---

## 模块职责

扩展选项页面为用户提供配置界面，允许用户控制深学助手在不同学习平台上的启用状态。该模块负责用户配置的读取、显示、修改和同步存储，是用户与扩展交互的主要入口。

## 入口与启动

### 主要文件
- **`options.html`**: 选项页面的HTML结构和样式
- **`options.js`**: 页面交互逻辑和数据处理

### 访问方式
1. 右键点击扩展图标 → "选项"
2. 扩展管理页面 → 扩展详情 → "扩展程序选项"
3. 通过manifest.json中的`options_page`配置自动注册

## 对外接口

### Chrome扩展API集成
- **Storage Sync API**: 跨设备同步用户配置
- **存储键名**: `enabledSites`
- **数据格式**: `{ 'www.0755tt.com': boolean }`

### 用户交互接口
- **站点开关控制**: 复选框形式的启用/禁用切换
- **实时保存**: 配置更改时自动保存到云端存储

## 关键依赖与配置

### 扩展权限要求
- `storage` 权限：访问Chrome的同步存储
- 需要在manifest.json中声明选项页面

### 技术依赖
- **Chrome Storage Sync**: 用户配置的跨设备同步
- **DOM API**: 页面元素操作和事件处理
- **现代CSS**: 系统字体和响应式设计

### 配置结构
```javascript
// 存储在chrome.storage.sync中的数据
{
  enabledSites: {
    'www.0755tt.com': true,   // 0755TT平台启用状态
    // 未来扩展的其他站点...
  }
}
```

## 数据模型

### 选项页面配置项
```html
<!-- 当前支持的配置项 -->
<input type="checkbox" id="site-0755tt" />
<label>启用：www.0755tt.com</label>
```

### JavaScript数据处理
```javascript
// 加载配置
chrome.storage.sync.get({ enabledSites: {} }, (data) => {
  const enabledSites = data.enabledSites || {};
  // 更新UI状态
});

// 保存配置
const enabledSites = {
  'www.0755tt.com': document.getElementById('site-0755tt').checked
};
chrome.storage.sync.set({ enabledSites });
```

## 测试与质量

### 用户界面测试
1. **配置加载测试**: 验证页面打开时正确显示当前配置状态
2. **实时保存测试**: 确认复选框更改时立即保存到存储  
3. **跨设备同步测试**: 验证配置在不同设备间的同步
4. **异常处理测试**: 测试存储API失败时的处理

### 用户体验特性
- **系统集成**: 使用系统字体确保与操作系统一致的外观
- **即时反馈**: 配置更改无需点击保存按钮
- **清晰说明**: 提供功能说明和扩展指引
- **响应式设计**: 适应不同窗口大小

### 代码质量特点
- ✅ 简洁的单页面应用设计
- ✅ 事件驱动的配置保存机制
- ✅ 现代CSS的系统字体栈
- ✅ 清晰的数据流处理
- ❌ 缺少输入验证和错误处理
- ❌ 无国际化支持

## 常见问题 (FAQ)

### Q: 为什么使用chrome.storage.sync而不是localStorage？
A: Storage Sync可以在用户的所有设备间同步配置，提供更好的用户体验，而localStorage只在本地设备有效。

### Q: 如何添加新站点的配置选项？
A: 1) 在options.html中添加新的checkbox，2) 在options.js中添加对应的加载和保存逻辑，3) 更新站点ID。

### Q: 配置保存失败会有提示吗？
A: 当前版本没有错误提示机制，这是一个可改进的地方。建议添加保存状态反馈。

### Q: 页面样式是否响应式？
A: 基本支持，使用了现代CSS和相对单位，但未针对移动端进行专门优化。

## 相关文件清单

```
options/
├── options.html      # 选项页面HTML结构
└── options.js        # 页面交互逻辑脚本
```

### 样式特性
```css
/* 现代系统字体栈 */
font-family: system-ui, -apple-system, Segoe UI, Roboto, 
            "Helvetica Neue", Arial, "Noto Sans", 
            "PingFang SC", "Hiragino Sans GB", 
            "Microsoft YaHei", sans-serif;

/* 卡片式布局 */
.card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 12px;
}
```

### 依赖关系
```
options/ 依赖：
├── chrome.storage.sync    # 扩展存储API
├── manifest.json          # 选项页面声明
└── DOM API               # 页面元素操作

被依赖关系：
└── content/loader.js      # 读取这里保存的配置
```

## 变更记录 (Changelog)

### 当前版本特性
- 支持0755TT站点的启用/禁用控制
- 实现配置的跨设备同步存储
- 提供清晰的用户界面设计
- 建立扩展功能的模块化控制
- 为未来站点扩展预留配置空间

### 未来改进方向
- 添加更多学习平台的支持
- 实现配置导入/导出功能
- 增加主题和语言设置
- 提供使用统计和帮助文档