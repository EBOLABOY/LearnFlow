// Centralized platform configuration
export const PLATFORMS = {
  '0755tt': {
    id: '0755tt',
    name: '0755TT智慧职教',
    domains: ['www.0755tt.com'],
    description: '深圳职业技术大学智慧职教平台',
    icon: '🎓',
    debugger_rules: [
      { url_pattern: '/video', agent_script: 'injected/agents/video-agent.js' },
      { url_pattern: '/student/section', agent_script: 'injected/agents/exam-agent.js' }
    ]
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
    icon: '🌐',
    debugger_rules: [
      { url_pattern: '/teacherTraining/courseDetail', agent_script: 'src/sites/smartedu/agent.js' },
      { url_pattern: '/study/', agent_script: 'src/sites/smartedu/agent.js' },
      { url_pattern: '/video/', agent_script: 'src/sites/smartedu/agent.js' },
      { url_pattern: '/exam/', agent_script: 'src/sites/smartedu/agent.js' },
      { url_pattern: '/training/', agent_script: 'src/sites/smartedu/agent.js' }
    ]
  }
};
