(() => {
  const ns = (window.DeepLearn ||= {});
  const consts = (ns.consts ||= {});

  // Messaging and agent
  consts.AGENT_ID = consts.AGENT_ID || 'deeplearn-exam-agent';

  // API endpoints and patterns
  consts.EXAM_SUBMIT_PATH = consts.EXAM_SUBMIT_PATH || '/prod-api/portal/lituoExamPaper/submit';
  consts.EXAM_PAPER_PATTERNS = consts.EXAM_PAPER_PATTERNS || [
    '/lituoExamPaper/userPaper/test/',
    '/userPaper/test/'
  ];

  // Headers captured for auth/signature
  consts.AUTH_HEADER_KEYS = consts.AUTH_HEADER_KEYS || [
    'authorization',
    'signcontent',
    'timestamp',
    'rolekey'
  ];
})();

