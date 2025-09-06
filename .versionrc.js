module.exports = {
  // 更新哪些文件的版本号
  bumpFiles: [
    { filename: 'package.json', type: 'json' },
    { filename: 'manifest.json', type: 'json' }
  ],
  // 生成的变更日志头部
  header: '# 深学助手 版本更新日志\n\n',
  // 自定义类型显示
  types: [
    { type: 'feat', section: '✨ 新功能' },
    { type: 'fix', section: '🐛 Bug 修复' },
    { type: 'perf', section: '⚡️ 性能优化' },
    { type: 'refactor', section: '🧹 重构' },
    { type: 'docs', section: '📝 文档', hidden: true },
    { type: 'style', section: '🎨 样式', hidden: true },
    { type: 'test', section: '✅ 测试', hidden: true },
    { type: 'chore', section: '🔧 杂务', hidden: true }
  ]
};

