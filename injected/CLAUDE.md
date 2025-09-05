[根目录](../CLAUDE.md) > **injected**

# 页面注入脚本

## 变更记录 (Changelog)

### 2025年09月05日 8:18:15 - 模块文档创建
- 创建页面注入脚本模块文档
- 分析Vue集成和视频控制机制
- 记录消息传递和安全控制策略

---

## 模块职责

页面注入脚本运行在页面主世界（Main World）中，能够直接访问页面的JavaScript变量和Vue实例，负责深度集成目标网站的前端框架，实现对视频播放器的精确控制和状态监控。

## 入口与启动

### 主入口文件：`video-agent.js`
- **执行环境**: 页面主世界（Main World Context）
- **注入方式**: 通过内容脚本动态创建script标签注入
- **权限范围**: 可访问页面所有JavaScript变量，但无法使用扩展API

### 注入流程
```javascript
// 在video.js中动态注入
const agentScript = document.createElement('script');
agentScript.src = chrome.runtime.getURL('injected/video-agent.js');
(document.head || document.documentElement).appendChild(agentScript);
```

## 对外接口

### 消息传递接口
#### 发送消息到控制器
```javascript
function postToController(type, payload) {
  window.postMessage({ 
    source: 'deeplearn-video-agent', 
    type, 
    payload,
    timestamp: Date.now()
  }, window.location.origin);
}
```

#### 接收控制器命令
```javascript
window.addEventListener('message', (event) => {
  if (event.data.target === 'deeplearn-video-agent') {
    // 处理命令
  }
});
```

### 支持的命令类型
- `PLAY_VIDEO`: 播放视频
- `CHANGE_VIDEO`: 切换到下一个视频
- `HANDLE_LOGIN`: 处理持续观看确认

### 报告的事件类型
- `VUE_INSTANCE_FOUND`: Vue实例发现状态
- `TIME_QUESTION_DETECTED`: 检测到视频中途弹题
- `VIDEO_ENDED`: 视频播放结束
- `VIDEO_PAUSED`: 视频暂停
- `CONTINUE_WATCH_REQUIRED`: 需要持续观看确认
- `VUE_INSTANCE_LOST`: Vue实例丢失

## 关键依赖与配置

### Vue框架集成
- **目标选择器**: `#app`, `.body-left`, `.content`, `.player-container`
- **Vue实例访问**: 通过`element.__vue__`属性访问Vue组件
- **组件查找策略**: 递归遍历`$children`查找包含`player`属性的组件

### 页面权限要求
- 需要在manifest.json中声明为web_accessible_resources
- 需要目标域名的host_permissions
- 依赖目标网站使用Vue.js框架

### 安全配置
```javascript
// 严格的消息源验证
if (event.source !== window || 
    event.origin !== TARGET_ORIGIN ||
    event.data.source !== 'expected-source') {
  return;
}
```

## 数据模型

### Vue组件结构识别
```javascript
// 目标Vue组件特征
{
  player: Object,              // 视频播放器实例
  timeQuestionStatus: boolean, // 中途弹题状态
  timeQuestionObj1: Object,    // 弹题数据
  dialogVisible: boolean,      // 视频结束对话框
  codeStatus: boolean,         // 持续观看状态
  key: number,                 // 当前视频索引
  list: Array                  // 视频列表
}
```

### 中途弹题数据结构
```javascript
{
  popUpAnswer: 1|0,           // 正确答案（1=正确，0=错误）
  // ... 其他题目属性
}
```

### URL参数提取
- `chapterId`: 章节ID（用于跳转）
- `semesterId`: 学期ID（用于跳转）

## 测试与质量

### 核心测试场景
1. **Vue实例发现测试**: 验证不同页面结构下的组件查找
2. **状态监控测试**: 测试各种视频状态的准确检测  
3. **命令执行测试**: 验证播放、暂停、切换等操作
4. **消息安全测试**: 确认跨域和恶意消息过滤
5. **异常恢复测试**: Vue实例丢失后的处理机制

### 监控策略
```javascript
// 2.5秒间隔的状态轮询
const monitorInterval = setInterval(() => {
  // 检查Vue实例状态
  // 报告各种事件
}, 2500);

// 30分钟超时保护
setTimeout(() => {
  clearInterval(monitorInterval);
}, 30 * 60 * 1000);
```

### 代码质量特点
- ✅ 严格的消息源验证机制
- ✅ 完善的Vue组件查找策略
- ✅ 超时保护防止内存泄漏
- ✅ 详细的状态变化日志
- ❌ 硬编码的Vue组件结构依赖
- ❌ 缺少网站框架变更的适应性

## 常见问题 (FAQ)

### Q: 为什么需要注入到页面主世界？
A: 内容脚本无法访问页面的JavaScript变量，而Vue实例和视频播放器都是页面JavaScript的一部分，只有在主世界才能直接操作。

### Q: Vue实例查找失败怎么办？
A: 设置了15秒超时，失败后会报告给控制器。可能需要更新选择器或等待页面完全加载。

### Q: 消息传递的安全性如何保证？  
A: 通过检查消息来源、目标域名、特定标识等多重验证，确保只处理合法的消息。

### Q: 如果目标网站停止使用Vue会怎样？
A: 需要重新适配新的前端框架，更新组件查找和状态监控逻辑。

### Q: 为什么使用轮询而不是事件监听？
A: Vue组件的状态变化可能不会触发DOM事件，轮询可以确保及时检测到所有状态变化。

## 相关文件清单

```
injected/
└── video-agent.js    # 页面注入脚本（唯一文件）
```

### 依赖关系
```
video-agent.js 依赖：
├── 目标页面的Vue.js框架
├── window.postMessage API
└── URL参数解析功能

被依赖关系：
├── src/sites/0755tt/video.js  # 动态注入此脚本
└── manifest.json              # 声明web_accessible_resources
```

### 通信对象
```
video-agent.js ↔ video.js (Controller)
    ├── 命令: PLAY_VIDEO, CHANGE_VIDEO, HANDLE_LOGIN
    └── 事件: VUE_INSTANCE_FOUND, TIME_QUESTION_DETECTED, VIDEO_ENDED
```

## 变更记录 (Changelog)

### 当前版本特性
- 支持Vue.js框架的深度集成
- 实现视频播放器的精确控制
- 提供实时的状态监控机制
- 建立安全的消息传递通道
- 支持多种视频场景的自动化处理