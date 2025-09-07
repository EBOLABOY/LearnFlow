(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  // [升级] 站点配置：选择器现在是按优先级排列的数组，以增强鲁棒性
  tt.examConfig = {
    selectors: {
      // 按钮查找保持不变，基于文本的匹配已经足够稳定
      startButtonTexts: ['开始测试', '进入考试'],
      retryButtonTexts: ['再测一次'],

      // 查找考试主弹窗和确认弹窗
      examDialog: [
        '.el-dialog__wrapper.preview',      // 优先：使用当前具体的 class
        '[aria-label="章节测试"]',        // 备用：使用功能性 aria-label，非常稳定
      ],
      confirmDialog: [
        '.el-dialog__wrapper:not(.preview)', // 优先：匹配非考试弹窗的对话框
        '[aria-label="提示"]',            // 备用：使用功能性 aria-label
        '.el-message-box__wrapper',         // 备用：Element UI 消息框的通用包装器
      ],
      // 查找各类确认按钮
      confirmOkButton: [
        '.el-dialog__footer .el-button--primary', // 优先：标准对话框的主按钮
        '.el-message-box__btns .el-button--primary', // 备用：消息框的主按钮
        '[class*="button--primary"]',           // 备用：模糊匹配 primary 按钮
      ],

      // [升级] 查找题目列表和单个题目
      questionList: [
        '.previewQuestion',                  // 优先：使用当前的 class
        '[aria-label="章节测试"] .el-dialog__body', // 备用：直接查找弹窗内容区
      ],
      questionItem: [
        '.previewQuestion > span > div',     // 优先：使用当前结构
        '.subject-option',                   // 备用：查找包含选项的容器
      ],
      questionTitle: ['.subject-title'],      // 题目标题选择器目前是稳定的

      // [升级] 查找选项，优先使用 WAI-ARIA role 属性
      radioOption: [
        'label[role="radio"]',
        '.el-radio'
      ],
      checkboxOption: [
        'label.el-checkbox',                 // Checkbox 的 label 没有 role, 但 class 比较稳定
        '[role="group"] .el-checkbox',
      ],
      radioLabel: ['.el-radio__label'],
      checkboxLabel: ['.el-checkbox__label'],

      // 提交按钮
      submitButton: [
        '.el-dialog__wrapper.preview .el-dialog__footer .el-button--primary',
        '[aria-label="章节测试"] .el-dialog__footer .el-button--primary',
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
  };
})();
