(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  // 站点配置（按优先级排列的数组，增强鲁棒性）
  tt.examConfig = {
    selectors: {
      // 文本按钮关键字（用于文本优先点击）
      startButtonTexts: ['开始测试', '开始测验', '进入考试'],
      retryButtonTexts: ['再测一次', '重新测试', '重新作答'],
      submitButtonTexts: ['提交', '交卷', '确定', '确认'],

      // 查找考试主弹窗和确认弹窗
      examDialog: [
        '.el-dialog__wrapper.preview',
        '.el-dialog__wrapper',
        '.el-dialog',
        '[aria-label="章节测试"]',
        'div.el-dialog__wrapper:has(.el-dialog__body)',
        'div:has(.subject-top)'
      ],
      confirmDialog: [
        '.el-dialog__wrapper:not(.preview)',
        '.el-message-box__wrapper',
        '[aria-label="提示"]',
        'div[role="dialog"][aria-label="提示"]',
        '.el-dialog[aria-label="提示"]',
        'div.el-dialog',
        'div[role="dialog"]',
      ],
      // 查找各类确认按钮（选择器优先，文本有兜底）
      confirmOkButton: [
        '.el-dialog__footer .el-button--primary',
        '.el-message-box__btns .el-button--primary',
        '[class*="button--primary"]',
      ],

      // 查找题目列表和单个题目 - 增强版本
      questionList: [
        '.previewQuestion',
        '[aria-label="章节测试"] .el-dialog__body',
        '.el-dialog__body',
        '.question-container',
        '[class*="question"]',
        'div:has(.subject-top)',
        'div:has(.subject-title)',
        'div:has(input[type="radio"])',
        'div:has(.el-radio)',
      ],
      questionItem: [
        '.previewQuestion span > div',
        'div:has(.subject-top)',
        '.previewQuestion .subject-top',
        '.subject-top',
      ],
      questionTitle: ['.subject-title'],

      // 查找选项
      radioOption: [
        'label[role="radio"]',
        '.el-radio'
      ],
      checkboxOption: [
        'label.el-checkbox',
        '[role="group"] .el-checkbox',
      ],
      radioLabel: ['.el-radio__label'],
      checkboxLabel: ['.el-checkbox__label'],

      // 提交按钮 - 增强版本（修复CSS兼容性）
      submitButton: [
        '.el-dialog__wrapper.preview .el-dialog__footer .el-button--primary',
        '[aria-label="章节测试"] .el-dialog__footer button:last-of-type',
        '.el-dialog__wrapper .el-dialog__footer .el-button--primary',
        '.el-dialog__footer button[type="button"]',
        '.el-dialog__footer .el-button',
        '.el-dialog__footer button',
        'button[class*="primary"]',
        '.el-button--primary:last-of-type',
        'button:last-of-type',
      ],

      // 最终确认对话框的确定按钮
      finalConfirmButton: [
        '.el-message-box__wrapper .el-button--primary',
        '[aria-label="提示"] .el-button--primary',
        '.el-message-box__btns .el-button--primary'
      ],

      loadingSpinner: ['.el-loading-mask'],
    },

    timeouts: {
      pageLoad: 60000,
      request: 10000,
    },
    delays: {
      beforeClick: { min: 200, max: 500 },
      afterClick: { min: 500, max: 1500 },
      answerNormal: { min: 2000, max: 4000 },
      answerComplex: { min: 3000, max: 6000 },
    },

    // 站点 API 路径匹配（供注入 Exam Agent 使用）
    examApiPatterns: [
      '/lituoExamPaper/userPaper/test/',
      '/userPaper/test'
    ],

    // 人性化作答策略（可由用户配置）
    answering: {
      humanize: {
        enabled: false,
        minWrong: 0,
        maxWrong: 1,
      },
      // 判断题答题模式（默认索引模式）
      // mode: 'index' | 'text'
      // trueIndex/falseIndex 为零基索引（仅在 index 模式下使用）
      // allowTextFallback: 当索引不合法时是否回退到文本匹配
      judge: {
        mode: 'index',
        trueIndex: 0,
        falseIndex: 1,
        allowTextFallback: false,
      },
    },
  };
})();
