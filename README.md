# 深学助手 (DeepLearn Assistant)

一个基于 Chrome 扩展 API v3 的在线学习提效工具。支持 0755TT、SmartEdu 等平台，提供稳定的视频自动化与考试辅助能力，追求最小权限、强兼容与易维护。

## 快速开始

```bash
# 安装依赖
npm install

# 开发构建（输出至 dist/）
npm run build

# 生产打包（生成可安装包）
npm run pack

# 运行测试
npm run test
```

加载扩展：Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序 → 选择 `dist/` 目录。

## 文档导航

- 文档首页：`docs/README.md`
- 使用入门：`docs/GETTING_STARTED.md`
- 开发指南：`docs/DEVELOPMENT.md`
- 发布流程：`docs/RELEASE.md`
- 质量与规范：`docs/QUALITY.md`
- 平台支持与适配：`docs/PLATFORMS.md`
- 架构白皮书：`ARCHITECTURE.md`
- 版本历史：`CHANGELOG.md`
- 部署指南：`DEPLOYMENT.md`
- 安全清单：`SECURITY_CHECKLIST.md`

## 目录概览（简）

```
extension/    # 扩展主文件（background、popup、manifest）
src/          # 核心能力与各站点适配
content/      # 内容脚本（loader）
injected/     # 页面注入脚本（按需）
options/      # 选项页面
scripts/      # 构建与工具脚本
database/     # 数据库定义（init.sql）
```

## 贡献与反馈

- 提交 Issue 反馈问题或建议
- PR 欢迎：保持变更聚焦与最小化、遵循现有风格

> 注：本仓库的最终真实来源为代码与 `database/init.sql`。文档保持聚焦“架构与方法论”，实现细节以源码为准。
