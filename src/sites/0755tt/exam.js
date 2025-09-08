(() => {
  // 命名空间与依赖
  const ns = (window.DeepLearn ||= {});
  const util = ns.util || {};
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});
  const { examConfig: config } = tt;

  // 动态答案通信
  const ANSWER_AGENT_ID = 'deeplearn-exam-agent';
  tt.__answersReady = tt.__answersReady || false;
  tt.__paperData = tt.__paperData || null;
  tt.__agentReady = tt.__agentReady || false;
  tt.__paperCaptured = tt.__paperCaptured || false; // 首次有效答卷到达后忽略后续

  // 来自页面主世界 Agent 的消息
  window.addEventListener('message', (event) => {
    try {
      if (event.source !== window || !event.data || event.origin !== window.location.origin) return;
      const { source, type, payload } = event.data;
      if (source !== ANSWER_AGENT_ID) return;
      if (type === 'AGENT_READY') {
        tt.__agentReady = true;
        try { (ns.util && ns.util.showMessage) && ns.util.showMessage('🛰️ Agent Ready', 2000, 'info'); } catch {}
        try {
          if (typeof Machine !== 'undefined' && Machine.currentState === Machine.states.WAITING_FOR_AGENT) {
            if (tt.__agentReady === true) {
      Machine.transitionTo(Machine.states.INITIALIZING);
    } else {
      Machine.transitionTo(Machine.states.WAITING_FOR_AGENT);
    }
          }
        } catch {}
        return;
      }
      if ((type === 'EXAM_PAPER_RECEIVED' || type === 'EXAM_PAPER_RAW') && tt.__paperCaptured) return;
      if (type === 'EXAM_PAPER_RECEIVED') {
        tt.__paperData = { questions: (payload && payload.questions) || [], raw: payload && payload.raw };
        tt.__answersReady = Array.isArray(tt.__paperData.questions) && tt.__paperData.questions.length > 0;
        tt.__paperCaptured = tt.__answersReady;
        console.log('[深学助手] 已拦截到试卷答案，题目数:', (tt.__paperData.questions || []).length);
        try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 已获取试卷答案，准备作答', 3000, 'success'); } catch {}
      } else if (type === 'EXAM_PAPER_RAW') {
        tt.__paperData = { questions: [], raw: payload && payload.raw };
      } else if (type === 'AGENT_READY') {
        tt.__agentReady = true;
        try { (ns.util && ns.util.showMessage) && ns.util.showMessage('🛰️ 拦截Agent已就绪', 2000, 'info'); } catch {}
      }
    } catch (e) {
      try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.exam', where: 'agentMessage' }); } catch {}
    }
  });

  // 来自背景页 CDP 兜底的消息
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (!message || !message.type) return;
        const { type, payload } = message;
        if ((type === 'EXAM_PAPER_RECEIVED' || type === 'EXAM_PAPER_RAW') && tt.__paperCaptured) return;
        if (type === 'EXAM_PAPER_RECEIVED') {
          tt.__paperData = { questions: (payload && payload.questions) || [], raw: payload && payload.raw };
          tt.__answersReady = Array.isArray(tt.__paperData.questions) && tt.__paperData.questions.length > 0;
          tt.__paperCaptured = tt.__answersReady;
          console.log('[深学助手][CDP] 收到试卷答案，题目数:', (tt.__paperData.questions || []).length);
          try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 已获取试卷答案（CDP）', 3000, 'success'); } catch {}
        } else if (type === 'EXAM_PAPER_RAW') {
          tt.__paperData = { questions: [], raw: payload && payload.raw };
          console.log('[深学助手][CDP] 收到试卷原始数据');
        } else if (type === 'AGENT_READY') {
          tt.__agentReady = true;
        }
      } catch (e) {}
    });
  } catch (_) {}

  // --- 鲁棒的选择器辅助函数 ---
  function querySelectorFallback(selectors, scope = document) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorArray) {
      const element = scope.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function querySelectorAllFallback(selectors, scope = document) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorArray) {
      const elements = scope.querySelectorAll(selector);
      if (elements.length > 0) return Array.from(elements);
    }
    return [];
  }

  function waitFor(conditionFn, timeout = (config?.timeouts?.pageLoad || 60000), pollInterval = 500, description = '未知条件') {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        try {
          const res = conditionFn();
          if (res) return resolve(res);
          if (Date.now() - start > timeout) return reject(new Error(`等待超时 (${timeout / 1000}s): ${description}`));
          setTimeout(tick, pollInterval);
        } catch (e) {
          reject(e);
        }
      };
      tick();
    });
  }

  

  function normalizeQuestionText(text) {
    if (!text) return '';
    // 移除题目前面的序号（如 "1."、"一、"），并去除所有不可见空白字符
    return text.trim().replace(/^\s*(\d+|[一二三四五六七八九十]+)[\s.、．,，]*/, '').replace(/\s/g, '');
  }

  

  // —— 答题匹配辅助：处理题干乱序与选项匹配 ——
  function normalizeText(s) {
    if (!s) return '';
    return String(s)
      .replace(/\s+/g, '')
      .replace(/[，。、“”‘’!！?？、:：;；\-—_\(\)（）\[\]【】<>《》\.|·]/g, '')
      .trim()
      .toLowerCase();
  }

  function getApiQuestionText(q) {
    if (!q || typeof q !== 'object') return '';
    const cand = q.question ?? q.title ?? q.stem ?? q.name ?? q.subject ?? q.content ?? '';
    return String(cand || '');
  }

  

  

  function answerIncorrectly(qEl) {
    // 检查是否已经有选中的选项（防止重复随机）
    const checks = querySelectorAllFallback(config.selectors.checkboxOption, qEl);
    const radios = querySelectorAllFallback(config.selectors.radioOption, qEl);
    
    // 对于单选题，如果已经有选中的，则不再改变
    if (radios.length > 0) {
      const hasChecked = radios.some(r => r.classList.contains('is-checked'));
      if (hasChecked) {
        console.log('[深学助手] 该题已有选中项，跳过随机选择');
        return;
      }
      // 随机选择一个选项
      const randomIndex = Math.floor(Math.random() * radios.length);
      util.simulateClick(radios[randomIndex]);
      console.log(`[深学助手] 随机选择了第 ${randomIndex + 1} 个选项`);
    }
    // 对于多选题，如果已经有选中的，也不再改变
    else if (checks.length > 0) {
      const hasChecked = checks.some(c => c.classList.contains('is-checked'));
      if (hasChecked) {
        console.log('[深学助手] 该题已有选中项，跳过随机选择');
        return;
      }
      // 随机选择1-2个选项
      const numToSelect = Math.min(checks.length, Math.floor(Math.random() * 2) + 1);
      const indices = Array.from({ length: checks.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      indices.slice(0, numToSelect).forEach(i => {
        util.simulateClick(checks[i]);
        console.log(`[深学助手] 随机选中了多选第 ${i + 1} 个选项`);
      });
    }
  }

  // 最终简化且健壮的版本
  async function answerCorrectlyDynamic(qEl, qData) {
    const questionText = (qData && getApiQuestionText(qData))
      ? getApiQuestionText(qData).substring(0, 30)
      : '未知题目';

    if (!qData || typeof qData.answer === 'undefined' || qData.answer === null) {
      console.warn(`[深学助手] 传入的题目数据无效或缺少答案: "${questionText}..."`);
      return false;
    }

    const correctAnswerStr = String(qData.answer).trim().toUpperCase();
    const questionType = String(qData.type);
    console.log(`[深学助手] 回答 "${questionText}..." | 类型: ${questionType} | API答案: ${correctAnswerStr}`);

    try {
      // 判断题（type: "1"）
      if (questionType === '1') {
        const radios = querySelectorAllFallback(config.selectors.radioOption, qEl);
        if (radios.length < 2) {
          console.warn('[深学助手] 判断题选项不足两个');
          return false;
        }

        const judgeCfg = (config && config.answering && config.answering.judge) || { mode: 'text' };
        let targetIndex = -1;

        // 优先使用索引模式（如果配置如此）
        if (judgeCfg.mode === 'index') {
          const tIdx = Number.isFinite(judgeCfg.trueIndex) ? judgeCfg.trueIndex : -1;
          const fIdx = Number.isFinite(judgeCfg.falseIndex) ? judgeCfg.falseIndex : -1;
          targetIndex = (correctAnswerStr === 'T') ? tIdx : fIdx;

          if (targetIndex >= 0 && targetIndex < radios.length) {
            if (!radios[targetIndex].classList.contains('is-checked')) {
              util.simulateClick(radios[targetIndex]);
            }
            console.log(`[深学助手] 判断题按索引 ${targetIndex} 选择`);
            return true;
          }
          if (!judgeCfg.allowTextFallback) {
            console.warn(`[深学助手] 判断题索引(${targetIndex})无效且不允许文本回退`);
            return false;
          }
          // 允许文本回退则继续查找文本
        }

        // 文本模式或作为回退：查找“正确/错误”
        const targetText = correctAnswerStr === 'T' ? '正确' : '错误';
        const matchedRadio = radios.find((radio) => {
          const label = querySelectorFallback(config.selectors.radioLabel, radio);
          return label && label.innerText.trim().includes(targetText);
        });

        if (matchedRadio) {
          if (!matchedRadio.classList.contains('is-checked')) {
            util.simulateClick(matchedRadio);
          }
          console.log(`[深学助手] 判断题按文本 "${targetText}" 选择`);
          return true;
        }

        console.warn('[深学助手] 未能为判断题找到任何有效答案选项。');
        return false;
      }

      // 单选/多选题（type: "2" 或 "3"）
      const correctIndices = new Set();
      correctAnswerStr.split(',').forEach((char) => {
        const idx = char.trim().toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
        if (idx >= 0 && idx < 26) correctIndices.add(idx);
      });

      if (correctIndices.size === 0) return false;

      const isMulti = questionType === '3';
      const options = querySelectorAllFallback(
        isMulti ? config.selectors.checkboxOption : config.selectors.radioOption,
        qEl
      );
      if (options.length === 0) return false;

      for (let idx = 0; idx < options.length; idx++) {
        const optionEl = options[idx];
        const shouldBeChecked = correctIndices.has(idx);
        const isChecked = optionEl.classList.contains('is-checked');
        if (shouldBeChecked !== isChecked) {
          util.simulateClick(optionEl);
          await util.sleep(util.randomDelay(200, 450));
        }
      }
      return true;
    } catch (e) {
      console.error(`[深学助手] 为 "${questionText}..." 选择答案时出错:`, e);
      return false;
    }
  }

  // 查找可见的对话框（过滤掉display:none的隐藏元素）
  function findVisibleDialog(selectors) {
    const elements = querySelectorAllFallback(selectors);
    // 使用util.isElementVisible检查元素是否真正可见
    return elements.find(el => {
      // 如果util.isElementVisible可用，使用它进行精确判断
      if (ns.util && typeof ns.util.isElementVisible === 'function') {
        return ns.util.isElementVisible(el);
      }
      // 降级方案：检查display和visibility
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }) || null;
  }

  function findButtonByTexts(texts, scope = document) {
    const list = Array.isArray(texts) ? texts : [texts];
    const btns = Array.from(scope.querySelectorAll('button'));
    return btns.find((b) => {
      // 获取按钮的文本内容（支持嵌套的span等元素）
      const t = (b.textContent || b.innerText || '').trim();
      const enabled = !(b.disabled || b.classList?.contains('is-disabled'));
      const visible = (ns.util && typeof ns.util.isElementVisible === 'function') ? ns.util.isElementVisible(b) : true;
      return enabled && visible && list.some((s) => {
        // 移除所有空格进行比较，以处理"确 定"这种带空格的文本
        const normalizedText = t.replace(/\s+/g, '');
        const normalizedSearch = s.replace(/\s+/g, '');
        return normalizedText.includes(normalizedSearch);
      });
    }) || null;
  }

  // 状态机
  const Machine = {
    states: {
      IDLE: 'IDLE',
      WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
      INITIALIZING: 'INITIALIZING',
      LOOKING_FOR_START: 'LOOKING_FOR_START',
      STARTING_EXAM: 'STARTING_EXAM',
      WAITING_FOR_ANSWERS: 'WAITING_FOR_ANSWERS',
      WAITING_FOR_QUESTIONS: 'WAITING_FOR_QUESTIONS',
      ANSWERING: 'ANSWERING',
      SUBMITTING: 'SUBMITTING',
      FINISHED: 'FINISHED',
      ERROR: 'ERROR',
    },
    currentState: 'IDLE',
    errorCount: 0,
    maxRetries: 3,
    lastError: null,
    stateHistory: [],
    transitionTo(newState) {
      console.log(`[状态机] ${this.currentState} -> ${newState}`);
      this.stateHistory.push({ from: this.currentState, to: newState, timestamp: Date.now() });
      // 保留最近10个状态转换记录
      if (this.stateHistory.length > 10) {
        this.stateHistory.shift();
      }
      this.currentState = newState;
      this.run();
    },
    async run() {
      try {
        switch (this.currentState) {
          case this.states.WAITING_FOR_AGENT: {
            console.log('[״̬��] �ȴ�Agent��Ϣ...');
            const self = this;
            setTimeout(() => {
              try {
                if (self.currentState === self.states.WAITING_FOR_AGENT) {
                  console.error('[״̬��] �ȴ�Agent����ʱ(20000ms)');
                  try { (ns.util && ns.util.showMessage) && ns.util.showMessage('Agent not ready. Aborting.', 8000, 'error'); } catch {}
                  self.transitionTo(self.states.ERROR);
                }
              } catch {}
            }, 20000);
            break;
          }
          case this.states.INITIALIZING: {
            const questionList = querySelectorFallback(config.selectors.questionList);
            const startBtn = findButtonByTexts(config.selectors.startButtonTexts);
            const retryBtn = findButtonByTexts(config.selectors.retryButtonTexts);

            // 如果入口元素尚未渲染，先耐心等待更长时间再分流
            if (!questionList && !(startBtn || retryBtn)) {
              console.log('[状态机] 正在等待考试入口...');
              await waitFor(
                () =>
                  findButtonByTexts(config.selectors.startButtonTexts) ||
                  findButtonByTexts(config.selectors.retryButtonTexts) ||
                  querySelectorFallback(config.selectors.questionList),
                30000,
                500,
                '考试入口（按钮或题目列表）'
              );

              const alreadyInExam = !!querySelectorFallback(config.selectors.questionList);
              if (alreadyInExam) {
                console.log('[状态机] 检测到已在考试中，直接进入答题流程');
                this.transitionTo(this.states.WAITING_FOR_ANSWERS);
              } else {
                console.log('[状态机] 检测到考试入口按钮');
                this.transitionTo(this.states.LOOKING_FOR_START);
              }
              break;
            }

            if (questionList) {
              console.log('[状态机] 检测到题目列表，准备答题');
              this.transitionTo(this.states.WAITING_FOR_ANSWERS);
            } else if (startBtn || retryBtn) {
              console.log('[状态机] 检测到开始或重试按钮');
              this.transitionTo(this.states.LOOKING_FOR_START);
            } else {
              console.log('[状态机] 等待入口元素出现...');
              await waitFor(
                () => findButtonByTexts(config.selectors.startButtonTexts) ||
                      findButtonByTexts(config.selectors.retryButtonTexts) ||
                      querySelectorFallback(config.selectors.questionList),
                10000, 500, '“开始/再测一次”按钮或题目列表'
              );
              this.run();
            }
            break;
          }

                    case this.states.LOOKING_FOR_START: {
            const btn = await waitFor(() =>
                findButtonByTexts(config.selectors.startButtonTexts) ||
                findButtonByTexts(config.selectors.retryButtonTexts),
                config.timeouts.pageLoad, 500, '“开始/再测一次”按钮');
            await util.sleep(util.randomDelay(config.delays.beforeClick.min, config.delays.beforeClick.max));
            util.simulateClick(btn);
            this.transitionTo(this.states.STARTING_EXAM);
            break;
          }

          case this.states.STARTING_EXAM: {
            // 每次开始考试前重置缓存的答案数据，避免使用到上一次的残留
            tt.__answersReady = false;
            tt.__paperData = null;
            tt.__paperCaptured = false;
            
            console.log('[状态机] 进入STARTING_EXAM状态，准备处理可能的多个前置对话框');
            
            // 处理可能的多个前置对话框（如温馨提示等）
            let dialogCount = 0;
            const maxDialogs = 5; // 最多处理5个连续的对话框
            
            while (dialogCount < maxDialogs) {
              // 先检查是否已经出现了【可见的】主考试窗口
              const examDialog = findVisibleDialog(config.selectors.examDialog);
              if (examDialog) {
                console.log('[状态机] 检测到可见的主考试窗口已打开，跳过对话框处理');
                this.transitionTo(this.states.WAITING_FOR_ANSWERS);
                break;
              }
              
              // 查找【可见的】前置确认对话框
              const confirmDialog = findVisibleDialog(config.selectors.confirmDialog);
              if (!confirmDialog) {
                // 没有可见的对话框，短暂等待后再检查一次
                console.log('[状态机] 未检测到可见的对话框，等待500ms后再次检查...');
                await sleep(500);
                
                // 再次检查是否有可见的考试窗口
                const examDialogRecheck = findVisibleDialog(config.selectors.examDialog);
                if (examDialogRecheck) {
                  console.log('[状态机] 可见的主考试窗口已出现');
                  this.transitionTo(this.states.WAITING_FOR_ANSWERS);
                  break;
                }
                
                // 如果等待了几轮还是没有任何对话框，可能有问题
                if (dialogCount > 2 && !confirmDialog) {
                  console.warn('[状态机] 未检测到预期的可见对话框，可能页面结构已改变');
                  this.transitionTo(this.states.WAITING_FOR_ANSWERS);
                  break;
                }
              } else {
                // 找到了可见的前置对话框
                dialogCount++;
                console.log(`[状态机] 发现第${dialogCount}个可见的前置对话框`);
                
                // 查找确定按钮（也要确保按钮可见）
                const okBtn = querySelectorFallback(config.selectors.confirmOkButton, confirmDialog);
                if (okBtn && ((ns.util && ns.util.isElementVisible && ns.util.isElementVisible(okBtn)) || okBtn.offsetParent !== null)) {
                  console.log(`[状态机] 找到可见的确定按钮，准备点击`);
                  await util.sleep(util.randomDelay(config.delays.beforeClick.min, config.delays.beforeClick.max));
                  util.simulateClick(okBtn);
                  console.log(`[状态机] 已点击确定按钮，等待对话框关闭...`);
                  
                  // 等待当前对话框消失（使用更精确的条件）
                  try {
                    await waitFor(
                      () => {
                        // 检查当前对话框是否还在DOM中且可见
                        if (!confirmDialog.isConnected) return true;
                        if (ns.util && typeof ns.util.isElementVisible === 'function') {
                          return !ns.util.isElementVisible(confirmDialog);
                        }
                        const style = window.getComputedStyle(confirmDialog);
                        return style.display === 'none' || style.visibility === 'hidden';
                      },
                      3000, // 缩短到3秒，避免等待太久
                      100,  // 更频繁的检查
                      `第${dialogCount}个对话框关闭`
                    );
                    console.log(`[状态机] 第${dialogCount}个对话框已关闭`);
                  } catch (e) {
                    console.warn(`[状态机] 等待对话框关闭超时，继续处理`);
                  }
                  
                  await util.sleep(util.randomDelay(config.delays.afterClick.min, config.delays.afterClick.max));
                } else {
                  console.warn(`[状态机] 在第${dialogCount}个对话框中未找到可见的确定按钮`);
                  await util.sleep(1000);
                }
              }
              
              // 防止无限循环
              if (dialogCount >= maxDialogs) {
                console.warn('[状态机] 已处理最大数量的对话框，继续下一步');
                break;
              }
            }
            
            // 最终检查是否进入了考试界面
            await util.sleep(500); // 给页面一点时间渲染
            const finalExamDialog = findVisibleDialog(config.selectors.examDialog);
            if (finalExamDialog) {
              console.log('[状态机] 成功进入可见的考试界面');
              this.transitionTo(this.states.WAITING_FOR_ANSWERS);
            } else if (this.currentState === this.states.STARTING_EXAM) {
              // 如果还在当前状态，可能需要更多时间
              console.log('[状态机] 等待考试界面变为可见...');
              try {
                await waitFor(
                  () => findVisibleDialog(config.selectors.examDialog),
                  5000,
                  250,
                  '可见的考试主窗口'
                );
                this.transitionTo(this.states.WAITING_FOR_ANSWERS);
              } catch (e) {
                console.warn('[状态机] 未能检测到可见的考试窗口，尝试继续');
                this.transitionTo(this.states.WAITING_FOR_ANSWERS);
              }
            }
            break;
          }

          case this.states.WAITING_FOR_ANSWERS: {
            try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('exam', 'wait.answers', 'info'); } catch {}
            try {
              await waitFor(() => tt.__answersReady === true, (config?.timeouts?.request || 20000), 500, 'Agent捕获答案');
            } catch (e) {
              console.warn('[深学助手] 未在超时内捕获到动态答案，采用降级作答策略继续');
            }
            this.transitionTo(this.states.WAITING_FOR_QUESTIONS);
            break;
          }

          case this.states.WAITING_FOR_QUESTIONS: {
            const root = querySelectorFallback(config.selectors.examDialog) || document;
            await waitFor(() => !querySelectorFallback(config.selectors.loadingSpinner, root), config.timeouts.pageLoad, 500, '加载动画消失');
            await waitFor(() => querySelectorFallback(config.selectors.questionList, root), config.timeouts.pageLoad, 500, '题目列表');
            this.transitionTo(this.states.ANSWERING);
            break;
          }

          case this.states.ANSWERING: {
            try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('exam', 'answer.start', 'info'); } catch {}
            const root = findVisibleDialog(config.selectors.examDialog) || document;
            const questionsOnPage = querySelectorAllFallback(config.selectors.questionItem, root);
            const questionsFromApi = (tt.__paperData && tt.__paperData.questions) || [];

            if (questionsOnPage.length === 0 || questionsFromApi.length === 0) {
              this.transitionTo(this.states.WAITING_FOR_QUESTIONS);
              return;
            }

            console.log(`[深学助手] 页面发现 ${questionsOnPage.length} 题，API提供 ${questionsFromApi.length} 题，开始分类匹配作答...`);

            // 人性化答错策略（按 API 题目索引决定）
            const humanizeCfg = (config && config.answering && config.answering.humanize) || { enabled: true, minWrong: 0, maxWrong: 1 };
            let errorsToMake = 0;
            if (humanizeCfg.enabled) {
              const min = Math.max(0, humanizeCfg.minWrong || 0);
              const max = Math.max(min, humanizeCfg.maxWrong || 0);
              errorsToMake = Math.min(questionsFromApi.length, Math.floor(Math.random() * (max - min + 1)) + min);
            }

            let allApiIndices = Array.from({ length: questionsFromApi.length }, (_, i) => i);
            for (let i = allApiIndices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [allApiIndices[i], allApiIndices[j]] = [allApiIndices[j], allApiIndices[i]];
            }
            const wrongAnswerApiIndices = new Set(allApiIndices.slice(0, errorsToMake));
            console.log(`[深学助手] 人性化策略: 计划答错 ${errorsToMake} 题 (enabled=${!!humanizeCfg.enabled})`);

            // 分类（通过 DOM 判定）
            const choiceElementsPage = questionsOnPage.filter((qEl) => !qEl.querySelector('.el-radio__original[value="正确"]'));
            const judgmentElementsPage = questionsOnPage.filter((qEl) => !!qEl.querySelector('.el-radio__original[value="正确"]'));

            const choiceQuestionsApi = questionsFromApi.filter((q) => String(q.type) !== '1');
            const judgmentQuestionsApi = questionsFromApi.filter((q) => String(q.type) === '1');

            console.log(`[深学助手] 分类完成 -> API: ${choiceQuestionsApi.length}选择题, ${judgmentQuestionsApi.length}判断题 | 页面: ${choiceElementsPage.length}选择题, ${judgmentElementsPage.length}判断题`);

            const matchedPageElements = new Set();

            // 先处理选择题
            for (const qData of choiceQuestionsApi) {
              const apiTitle = normalizeQuestionText(getApiQuestionText(qData));
              const apiIndex = questionsFromApi.indexOf(qData);

              const matchedEl = choiceElementsPage.find((qEl) => {
                if (matchedPageElements.has(qEl)) return false;
                const pageTitleEl = querySelectorFallback(config.selectors.questionTitle, qEl);
                const pageTitle = normalizeQuestionText(pageTitleEl ? pageTitleEl.innerText : '');
                return pageTitle && apiTitle && (pageTitle.includes(apiTitle) || apiTitle.includes(pageTitle));
              });

              if (matchedEl) {
                matchedPageElements.add(matchedEl);
                if (wrongAnswerApiIndices.has(apiIndex)) {
                  console.log(`[深学助手] 策略：匹配成功，故意答错选择题 "${apiTitle.substring(0, 20)}..."`);
                  answerIncorrectly(matchedEl);
                } else {
                  const success = await answerCorrectlyDynamic(matchedEl, qData);
                  if (!success) answerIncorrectly(matchedEl);
                }
              } else {
                console.warn(`[深学助手] 未能在页面上找到选择题 "${apiTitle.substring(0, 20)}..."`);
              }
              await util.sleep(util.randomDelay(400, 800));
            }

            // 再处理判断题
            for (const qData of judgmentQuestionsApi) {
              const apiTitle = normalizeQuestionText(getApiQuestionText(qData));
              const apiIndex = questionsFromApi.indexOf(qData);

              const matchedEl = judgmentElementsPage.find((qEl) => {
                if (matchedPageElements.has(qEl)) return false;
                const pageTitleEl = querySelectorFallback(config.selectors.questionTitle, qEl);
                const pageTitle = normalizeQuestionText(pageTitleEl ? pageTitleEl.innerText : '');
                return pageTitle && apiTitle && (pageTitle.includes(apiTitle) || apiTitle.includes(pageTitle));
              });

              if (matchedEl) {
                matchedPageElements.add(matchedEl);
                if (wrongAnswerApiIndices.has(apiIndex)) {
                  console.log(`[深学助手] 策略：匹配成功，故意答错判断题 "${apiTitle.substring(0, 20)}..."`);
                  answerIncorrectly(matchedEl);
                } else {
                  const success = await answerCorrectlyDynamic(matchedEl, qData);
                  if (!success) answerIncorrectly(matchedEl);
                }
              } else {
                console.warn(`[深学助手] 未能在页面上找到判断题 "${apiTitle.substring(0, 20)}..."`);
              }
              await util.sleep(util.randomDelay(400, 800));
            }

            console.log('[深学助手] 所有题目已处理完毕，准备提交');
            this.transitionTo(this.states.SUBMITTING);
            break;
          }

          case this.states.SUBMITTING: {
            const root = findVisibleDialog(config.selectors.examDialog) || document;
            
            // 步骤1：找到主考试窗口的"提交/交卷"按钮
            const submitBtn = await waitFor(
              () => querySelectorFallback(config.selectors.submitButton, root),
              10000, 500, '"提交/交卷"按钮'
            );

            console.log('[状态机] 找到并点击"提交/交卷"按钮');
            await util.sleep(util.randomDelay(config.delays.beforeClick.min, config.delays.beforeClick.max));
            
            // 步骤2：点击提交，这就是最后一步操作
            util.simulateClick(submitBtn);
            
            // 增加一个短暂的延迟，确保请求有时间发出
            await util.sleep(1500);
            
            console.log('[状态机] 提交操作已执行，流程结束。');

            // 步骤3：立即转换到完成状态
            this.transitionTo(this.states.FINISHED);
            break;
          }

          case this.states.FINISHED: {
            try {
               util.showMessage('✅ 考试已自动完成！', 5000, 'success');
            } catch {}
            console.log('[深学助手] 所有流程已完成。');
            this.errorCount = 0; // 成功完成，重置错误计数
            break;
          }

          case this.states.ERROR: {
            console.error('[状态机] 进入错误状态，错误详情:', this.lastError);
            console.log('[状态机] 状态历史:', this.stateHistory);
            
            // 检查是否可以重试
            if (this.errorCount < this.maxRetries) {
              this.errorCount++;
              console.log(`[状态机] 尝试恢复 (${this.errorCount}/${this.maxRetries})...`);
              try { util.showMessage(`⚠️ 出现错误，正在重试 (${this.errorCount}/${this.maxRetries})...`, 3000, 'warning'); } catch {}
              
              // 等待一段时间后重试
              await util.sleep(2000 * this.errorCount); // 递增等待时间
              
              // 根据错误前的状态决定恢复点
              const lastValidState = this.stateHistory
                .filter(h => h.from !== this.states.ERROR && h.to !== this.states.ERROR)
                .pop();
              
              if (lastValidState) {
                console.log(`[状态机] 尝试从 ${lastValidState.from} 状态恢复`);
                // 根据之前的状态决定恢复策略
                if (lastValidState.from === this.states.STARTING_EXAM) {
                  // 如果是在处理对话框时出错，重新初始化
                  this.transitionTo(this.states.INITIALIZING);
                } else if (lastValidState.from === this.states.ANSWERING) {
                  // 如果是在答题时出错，重新等待题目
                  this.transitionTo(this.states.WAITING_FOR_QUESTIONS);
                } else {
                  // 其他情况重新初始化
                  this.transitionTo(this.states.INITIALIZING);
                }
              } else {
                // 没有有效的历史状态，重新开始
                this.transitionTo(this.states.INITIALIZING);
              }
            } else {
              // 超过最大重试次数
              console.error('[状态机] 已达到最大重试次数，停止自动化');
              try { util.showMessage('❌ 自动化失败，请手动操作或刷新页面重试', 10000, 'error'); } catch {}
            }
            break;
          }

          case this.states.IDLE:
          default:
            break;
        }
      } catch (error) {
        console.error(`[状态机] 在 ${this.currentState} 状态下发生错误:`, error);
        this.lastError = {
          state: this.currentState,
          error: error.message || error,
          stack: error.stack,
          timestamp: Date.now()
        };
        
        // 避免ERROR状态的无限循环
        if (this.currentState !== this.states.ERROR) {
          try { util.showMessage(`❌ 自动化出错: ${error.message}`, 5000, 'error'); } catch {}
          this.transitionTo(this.states.ERROR);
        } else {
          console.error('[状态机] 在ERROR状态下又发生错误，停止执行');
        }
      }
    },
    reset() {
      console.log('[状态机] 重置状态机');
      this.currentState = this.states.IDLE;
      this.errorCount = 0;
      this.lastError = null;
      this.stateHistory = [];
      tt.__answersReady = false;
      tt.__paperData = null;
      tt.__paperCaptured = false;
    }
  };

  // 入口
  tt.initExam = function initExam() {
    console.log('[深学助手] 启动基于状态机的 Exam Controller...');
    tt.__running = true;
    if (tt.__agentReady === true) {
      Machine.transitionTo(Machine.states.INITIALIZING);
    } else {
      Machine.transitionTo(Machine.states.WAITING_FOR_AGENT);
    }
  };
})();
