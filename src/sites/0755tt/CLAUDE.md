[根目录](../../CLAUDE.md) > [src](../) > **sites** > **0755tt**

# 0755TT站点适配模块

## 变更记录 (Changelog)

### 2025年09月05日 8:18:15 - 模块文档创建
- 创建0755TT站点适配模块文档
- 分析视频自动化和考试自动化功能
- 记录题库结构和核心逻辑

---

## 模块职责

0755TT站点适配模块是专门为`www.0755tt.com`学习平台设计的自动化脚本模块，实现视频播放自动化和章节考试自动化功能。该模块通过分析页面URL路径智能识别当前场景，并启动相应的自动化流程。

## 入口与启动

### 主入口文件：`index.js`
```javascript
// 站点匹配逻辑
matches(loc) {
  return /(^|\.)0755tt\.com$/i.test(loc.hostname);
}

// 场景识别与路由
if (/\/student\/section/.test(href)) {
  console.log('[深学助手] 章节测试模式');
  tt.initExam();
} else if (/\/video/.test(href)) {
  console.log('[深学助手] 视频播放模式');
  tt.initVideo();
}
```

### 启动流程
1. 通过站点注册器自动注册到全局registry
2. 内容脚本加载器检测到匹配的域名后调用`init()`方法
3. 根据URL路径判断当前页面类型
4. 启动对应的自动化模块（视频或考试）

## 对外接口

### 注册到全局命名空间
- **命名空间**: `window.DeepLearn.sites.tt0755`
- **站点ID**: `www.0755tt.com`
- **站点名称**: `0755TT 学习平台`

### 主要方法
- `initVideo()`: 初始化视频自动化控制器
- `initExam()`: 初始化考试自动化控制器
- `questionBank`: 题库数据映射表

## 关键依赖与配置

### 依赖模块
- `DeepLearn.registry`: 站点注册器
- `DeepLearn.util`: 工具函数库（随机延迟、模拟点击等）
- Chrome扩展API：`chrome.runtime.getURL`用于注入脚本

### 配置要求
- 需要在扩展选项页面中启用`www.0755tt.com`站点
- 需要`host_permissions`包含`*://www.0755tt.com/*`
- 需要web accessible resources权限访问注入脚本

## 数据模型

### 题库结构（questionBank.js）
```javascript
// Map结构存储题目与答案的对应关系
bankNS.questionBank = new Map([
  ["题目文本", "答案标识"],
  // T/F: 判断题答案
  // A,B,C,D: 多选题答案  
  // A/B/C/D: 单选题答案
]);
```

### 题库统计
- 总题目数：37道
- 判断题：17道（T/F格式）
- 单选题：10道（A/B/C/D格式）
- 多选题：10道（A,B,C,D组合格式）

### 消息传递格式
```javascript
// Controller -> Agent
{
  target: 'deeplearn-video-agent',
  command: 'PLAY_VIDEO|CHANGE_VIDEO|HANDLE_LOGIN',
  payload: {},
  source: 'deeplearn-video-controller'
}

// Agent -> Controller  
{
  source: 'deeplearn-video-agent',
  type: 'VIDEO_PAUSED|TIME_QUESTION_DETECTED|VIDEO_ENDED',
  payload: { /* 具体数据 */ },
  timestamp: Date.now()
}
```

## 测试与质量

### 视频自动化测试场景
1. **Vue实例检测**: 验证能否成功找到页面Vue组件
2. **视频播放控制**: 测试暂停恢复、切换下一个视频
3. **中途弹题处理**: 验证题目识别和自动答题
4. **课程完成跳转**: 测试跳转到章节测试页面

### 考试自动化测试场景  
1. **开始测试按钮点击**: 验证能否找到并点击开始按钮
2. **题目解析匹配**: 测试题库查找和答案匹配准确性
3. **人性化答错策略**: 验证随机答错1-2题的逻辑
4. **自动提交流程**: 测试答题完成后的提交操作

### 代码质量特点
- ✅ 完整的错误处理和日志记录
- ✅ 随机延迟模拟人工操作
- ✅ 安全的消息传递验证
- ✅ 超时保护机制
- ❌ 缺少单元测试
- ❌ 硬编码的选择器可能因页面更新失效

## 常见问题 (FAQ)

### Q: 为什么需要分离Controller和Agent？
A: Controller运行在内容脚本沙箱中，无法直接访问页面的Vue实例。Agent注入到页面主世界，可以访问Vue但无法使用扩展API。两者通过postMessage通信。

### Q: 如何添加新的题目到题库？
A: 编辑`questionBank.js`文件，在Map中添加新的键值对，键为题目完整文本，值为答案标识。

### Q: 为什么要故意答错一些题目？
A: 为了模拟真实用户行为，避免被检测为机器操作，采用随机答错1-2题的人性化策略。

### Q: 如果页面结构改变怎么办？
A: 需要更新对应的CSS选择器，主要涉及`.el-dialog__wrapper`、`.el-radio__label`、`.el-button span`等选择器。

## 相关文件清单

```
src/sites/0755tt/
├── index.js           # 站点注册和路由逻辑
├── video.js           # 视频自动化控制器
├── exam.js            # 考试自动化控制器  
└── questionBank.js    # 题库数据存储
```

### 依赖文件
- `injected/video-agent.js`: 页面注入的视频控制代理
- `src/util.js`: 工具函数库
- `src/registry.js`: 站点注册器

## 变更记录 (Changelog)

### 当前版本特性
- 支持视频自动播放和切换
- 支持中途弹题自动答题
- 支持章节考试自动化
- 实现人性化答题策略
- 提供完整的错误处理和日志