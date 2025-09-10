// 自适应选择器发现系统
(() => {
  const ns = (window.DeepLearn ||= {});
  const adaptiveSelectors = (ns.adaptiveSelectors ||= {});

  // 智能选择器发现引擎
  adaptiveSelectors.discoverSelectors = function() {
    const discovered = {};
    
    // 1. 题目容器发现 - 基于语义特征而非CSS类
    discovered.questionItems = discoverQuestionContainers();
    
    // 2. 选项发现 - 基于表单元素特征
    discovered.radioOptions = discoverRadioOptions();
    discovered.checkboxOptions = discoverCheckboxOptions();
    
    // 3. 按钮发现 - 基于文本内容
    discovered.submitButtons = discoverSubmitButtons();
    
    console.log('[深学助手] 自适应发现的选择器:', discovered);
    return discovered;
  };

  // 基于语义特征发现题目容器 - 增强版本
  function discoverQuestionContainers() {
    const candidates = [];
    
    // 策略1: 寻找包含题目编号和标题的容器
    const elementsWithNumbers = document.querySelectorAll('*');
    elementsWithNumbers.forEach(el => {
      const text = el.textContent?.trim() || '';
      // 匹配 "1. 题目内容" 或 "第1题" 等模式
      if (/^\s*(\d+[.、]|\d+\s*[.、]|第\d+题)/.test(text)) {
        // 向上查找包含选项的祖先容器
        let container = el;
        for (let i = 0; i < 5; i++) {
          container = container.parentElement;
          if (!container) break;
          
          // 检查是否包含单选或多选元素
          const hasOptions = container.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], .el-radio, .el-checkbox');
          if (hasOptions) {
            candidates.push({
              element: container,
              confidence: calculateConfidence(container),
              selector: generateSelector(container)
            });
            break;
          }
        }
      }
    });
    
    // 策略2: 寻找对话框中的内容区域
    const dialogBodies = document.querySelectorAll('.el-dialog__body, .modal-body, [class*="dialog"] [class*="body"]');
    dialogBodies.forEach(body => {
      // 检查是否包含题目相关内容
      const hasQuestionContent = body.querySelector('input[type="radio"], input[type="checkbox"], .el-radio, .el-checkbox') ||
                                body.textContent.includes('题') ||
                                body.textContent.includes('选择') ||
                                body.textContent.includes('判断');
      
      if (hasQuestionContent) {
        candidates.push({
          element: body,
          confidence: calculateConfidence(body) + 15, // 对话框内容区域加分
          selector: generateSelector(body)
        });
      }
    });
    
    // 策略3: 寻找包含多个选项的容器
    const optionContainers = document.querySelectorAll('div, section, article');
    optionContainers.forEach(container => {
      const radioCount = container.querySelectorAll('input[type="radio"], .el-radio').length;
      const checkboxCount = container.querySelectorAll('input[type="checkbox"], .el-checkbox').length;
      
      // 如果包含2个以上的选项元素，很可能是题目容器
      if (radioCount >= 2 || checkboxCount >= 2) {
        candidates.push({
          element: container,
          confidence: calculateConfidence(container) + Math.min((radioCount + checkboxCount) * 3, 20),
          selector: generateSelector(container)
        });
      }
    });
    
    // 策略4: 基于类名的语义匹配
    const semanticSelectors = [
      '[class*="question"]',
      '[class*="exam"]',
      '[class*="test"]',
      '[class*="subject"]',
      '[class*="item"]',
      '[id*="question"]',
      '[id*="exam"]'
    ];
    
    semanticSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // 验证是否真的包含题目内容
          const hasOptions = el.querySelector('input[type="radio"], input[type="checkbox"], .el-radio, .el-checkbox');
          if (hasOptions) {
            candidates.push({
              element: el,
              confidence: calculateConfidence(el) + 10, // 语义匹配加分
              selector: generateSelector(el)
            });
          }
        });
      } catch (e) {
        console.warn(`[自适应发现] 语义选择器失败: ${selector}`, e);
      }
    });
    
    // 按置信度排序，去重并返回最可能的候选
    const uniqueCandidates = [];
    const seenSelectors = new Set();
    
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    candidates.forEach(candidate => {
      if (!seenSelectors.has(candidate.selector)) {
        seenSelectors.add(candidate.selector);
        uniqueCandidates.push(candidate);
      }
    });
    
    const result = uniqueCandidates.slice(0, 5).map(c => c.selector);
    console.log(`[自适应发现] 发现了 ${result.length} 个潜在题目容器:`, result);
    return result;
  }

  // 发现单选按钮
  function discoverRadioOptions() {
    const selectors = [];
    
    // 优先级1: 标准HTML radio
    if (document.querySelector('input[type="radio"]')) {
      selectors.push('label:has(input[type="radio"])');
    }
    
    // 优先级2: WAI-ARIA role
    if (document.querySelector('[role="radio"]')) {
      selectors.push('[role="radio"]');
    }
    
    // 优先级3: 常见UI框架模式
    const frameworkPatterns = [
      '.el-radio',     // Element UI
      '.ant-radio',    // Ant Design  
      '.radio',        // Bootstrap
      '.v-radio'       // Vuetify
    ];
    
    frameworkPatterns.forEach(pattern => {
      if (document.querySelector(pattern)) {
        selectors.push(pattern);
      }
    });
    
    return selectors;
  }

  // 发现复选框
  function discoverCheckboxOptions() {
    const selectors = [];
    
    if (document.querySelector('input[type="checkbox"]')) {
      selectors.push('label:has(input[type="checkbox"])');
    }
    
    if (document.querySelector('[role="checkbox"]')) {
      selectors.push('[role="checkbox"]');
    }
    
    const frameworkPatterns = ['.el-checkbox', '.ant-checkbox', '.checkbox', '.v-checkbox'];
    frameworkPatterns.forEach(pattern => {
      if (document.querySelector(pattern)) {
        selectors.push(pattern);
      }
    });
    
    return selectors;
  }

  // 基于文本内容发现提交按钮 - 增强版本
  function discoverSubmitButtons() {
    const submitTexts = ['确定', '提交', '交卷', '完成', '确认', 'Submit', 'Confirm', '下一步', '继续'];
    const buttons = [];
    
    // 策略1: 查找所有按钮元素（包括伪按钮）
    const buttonSelectors = [
      'button',
      '[role="button"]', 
      'input[type="submit"]',
      'input[type="button"]',
      '.el-button',
      '[class*="button"]',
      'a[class*="btn"]',
      'div[onclick]'
    ];
    
    buttonSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(btn => {
          const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
          if (submitTexts.some(submitText => text.includes(submitText))) {
            const generatedSelector = generateButtonSelector(btn);
            if (generatedSelector && !buttons.includes(generatedSelector)) {
              buttons.push(generatedSelector);
            }
          }
        });
      } catch (e) {
        console.warn(`[自适应发现] 按钮选择器失败: ${selector}`, e);
      }
    });
    
    // 策略2: 基于位置的推测（对话框底部的按钮通常是提交按钮）
    const dialogFooterButtons = document.querySelectorAll('.el-dialog__footer button, .modal-footer button, [class*="dialog"] [class*="footer"] button');
    dialogFooterButtons.forEach(btn => {
      const selector = generateButtonSelector(btn);
      if (selector && !buttons.includes(selector)) {
        buttons.push(selector);
      }
    });
    
    // 策略3: 主按钮样式推测
    const primaryButtons = document.querySelectorAll('[class*="primary"], [class*="main"], [class*="confirm"]');
    primaryButtons.forEach(btn => {
      if (btn.tagName === 'BUTTON' || btn.getAttribute('role') === 'button') {
        const selector = generateButtonSelector(btn);
        if (selector && !buttons.includes(selector)) {
          buttons.push(selector);
        }
      }
    });
    
    console.log(`[自适应发现] 发现了 ${buttons.length} 个潜在提交按钮:`, buttons);
    return buttons;
  }

  // 生成按钮专用选择器
  function generateButtonSelector(button) {
    // 优先使用稳定的属性组合
    if (button.id && !/^\d/.test(button.id)) {
      return `#${button.id}`;
    }
    
    // 使用类名组合
    const classes = (button.className || '').split(' ').filter(cls => 
      cls && 
      !cls.match(/^\d/) && 
      cls.length > 2 &&
      !cls.includes('focus') &&
      !cls.includes('hover') &&
      !cls.includes('active')
    );
    
    if (classes.length > 0) {
      // 优先使用语义化类名
      const semanticClasses = classes.filter(cls => 
        cls.includes('button') || 
        cls.includes('primary') || 
        cls.includes('confirm') || 
        cls.includes('submit')
      );
      
      if (semanticClasses.length > 0) {
        return `.${semanticClasses[0]}`;
      }
      
      return `.${classes[0]}`;
    }
    
    // 使用属性选择器
    if (button.getAttribute('role') === 'button') {
      return '[role="button"]';
    }
    
    if (button.type === 'submit') {
      return 'input[type="submit"]';
    }
    
    // 使用文本内容生成选择器（改为JavaScript过滤方式）
    const text = button.textContent?.trim();
    if (text && text.length < 20) {
      // 不使用CSS :contains()，而是返回一个标记，让调用方进行文本匹配
      const tagName = button.tagName.toLowerCase();
      // 尝试通过属性或位置来定位
      if (button.getAttribute('aria-label') && button.getAttribute('aria-label').includes(text)) {
        return `${tagName}[aria-label*="${text}"]`;
      }
    }
    
    // 最后使用位置选择器
    const parent = button.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(el => el.tagName === button.tagName);
      const index = siblings.indexOf(button);
      if (index >= 0) {
        const tagName = button.tagName.toLowerCase();
        return `${tagName}:nth-of-type(${index + 1})`;
      }
    }
    
    return null;
  }

  // 计算容器的置信度分数
  function calculateConfidence(container) {
    let score = 0;
    
    // 包含题目编号 (+30分)
    if (/^\s*\d+[.、]/.test(container.textContent)) score += 30;
    
    // 包含选项元素 (+25分)
    const optionCount = container.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]').length;
    score += Math.min(optionCount * 5, 25);
    
    // 包含题目关键词 (+20分)
    const questionKeywords = ['以下', '关于', '下列', '哪个', '哪些', '正确的是', '错误的是'];
    const hasKeywords = questionKeywords.some(keyword => container.textContent.includes(keyword));
    if (hasKeywords) score += 20;
    
    // 结构合理性 (+15分)
    const hasTitle = container.querySelector('.title, .subject-title, [class*="title"]');
    const hasOptions = container.querySelector('.option, .subject-option, [class*="option"]');
    if (hasTitle && hasOptions) score += 15;
    
    // 尺寸合理性 (+10分)
    const textLength = container.textContent.trim().length;
    if (textLength > 20 && textLength < 1000) score += 10;
    
    return score;
  }

  // 生成稳定的选择器
  function generateSelector(element) {
    // 优先使用稳定的属性
    if (element.id && !/^[0-9]/.test(element.id)) {
      return `#${element.id}`;
    }
    
    // 使用语义化的类名
    const semanticClasses = element.className.split(' ')
      .filter(cls => /^(question|subject|item|container|title|option)/.test(cls))
      .filter(cls => !/^[0-9]/.test(cls)); // 排除纯数字类名
    
    if (semanticClasses.length > 0) {
      return `.${semanticClasses[0]}`;
    }
    
    // 使用标签名 + 位置
    const tagName = element.tagName.toLowerCase();
    const siblings = Array.from(element.parentElement?.children || [])
      .filter(el => el.tagName === element.tagName);
    const index = siblings.indexOf(element);
    
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  // 验证选择器有效性
  adaptiveSelectors.validateSelectors = function(selectors) {
    const valid = {};
    
    Object.keys(selectors).forEach(key => {
      const selectorList = selectors[key];
      valid[key] = selectorList.filter(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          return elements.length > 0;
        } catch (e) {
          console.warn(`[选择器验证] 无效选择器: ${selector}`, e);
          return false;
        }
      });
    });
    
    return valid;
  };
})();