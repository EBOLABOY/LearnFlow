# 贡献指南（Contributing）

感谢你愿意为「深学助手（DeepLearn Assistant）」贡献力量！本项目坚持质量第一与中文优先，以下内容帮助你高效开展工作。

## 快速上手
- 环境要求：Node.js 18+，npm 8+
- 安装依赖：`npm ci`（推荐）或 `npm i`
- 开发构建：`npm run build`（输出到 `dist/`）
- 生产打包：`npm run pack`（生成 `release/*.zip`）
- 运行测试：`npm test` 或 `npm run test:coverage`
- 文档导航：根目录 `README.md` 与 `docs/` 目录

## 分支与提交
- 主分支：`main`（或 `master`），禁止直接推送到受保护分支
- 工作分支：`feature/*`、`fix/*`、`docs/*`、`chore/*`
- 提交规范：遵循 Conventional Commits
  - `feat: ` 新功能
  - `fix: ` 修复缺陷
  - `docs: ` 文档更新
  - `test: ` 测试相关
  - `chore: ` 构建/依赖/脚手架
  - `refactor: ` 重构（不改外部行为）
  - `perf: ` 性能优化

示例：
```
feat(0755tt): 支持章节测试自动提交并优化错题策略
fix(smartedu): 修复课程详情页DOM选择器变化导致的匹配失败
```

## 代码质量
- 统一编码：UTF-8（已配置编码检测 `scripts/check-encoding.js`）
- 代码风格：遵循已有风格，必要中文注释，避免过度抽象
- 结构原则：关注点分离、模块内聚、尽量无副作用
- 测试要求：新增/修改的关键逻辑需包含单元测试（`jest` + `jsdom`）
- 安全与隐私：遵循 `SECURITY_CHECKLIST.md`，避免提交敏感信息

## 开发与调试
- 本地构建：`npm run build`（dev）或 `npm run build:prod`（启用压缩，不进行代码混淆）
- 加载扩展：Chrome → 扩展程序 → 开发者模式 → 加载已解压 → 选择 `dist/`
- 内容脚本调试：DevTools → Sources → `chrome-extension://...`
- Source Map：如已生成将在 CI 中上传 Sentry（见 `docs/SENTRY_SETUP.md`）

## 发布与版本
- 版本原则：SemVer（主/次/补丁）
- 版本工具：`standard-version`（`npm run release` 自动生成 CHANGELOG 与 tag）
- CI 发布：推送 `vX.Y.Z` 标签将触发 GitHub Actions 构建与 Release（见 `.github/workflows/release.yml`）

## 提交 PR 前自检清单
- [ ] 变更聚焦且最小化
- [ ] 通过 `npm test`，必要时补充用例
- [ ] 构建通过（至少 `npm run build`）
- [ ] 更新相关文档（`README.md` / `docs/*`）
- [ ] 自我审阅：命名、异常、边界、日志

## 行为准则
请阅读并遵守 `CODE_OF_CONDUCT.md`。尊重与合作能让项目更好更久。

## 讨论与支持
- 报告问题：提交 Issue（选择合适模板，提供可复现信息）
- 功能建议：提交 Issue 或 PR 草案（阐明场景与价值）

感谢你的贡献！
