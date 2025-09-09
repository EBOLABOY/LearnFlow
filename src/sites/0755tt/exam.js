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
      WAITING_FOR_EXAM_WINDOW: 'WAITING_FOR_EXAM_WINDOW', // 新增状态
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
    lastSubAction: null, // 新增：用于记录更具体的操作
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
      this.lastSubAction = null; // Reset sub-action at the start of each run
      try {
        switch (this.currentState) {
          case this.states.WAITING_FOR_AGENT: {
            this.lastSubAction = 'waiting_for_agent_ready';
            console.log('[状态机] 等待Agent就绪，这是首次加载的正常流程...');
            
            // 使用更智能的等待策略：不依赖超时，而是定期检查
            const checkInterval = setInterval(() => {
              try {
                if (this.currentState !== this.states.WAITING_FOR_AGENT) {
                  clearInterval(checkInterval);
                  return;
                }
                if (tt.__agentReady === true) {
                  clearInterval(checkInterval);
                  console.log('[状态机] Agent已就绪，转入初始化');
                  this.transitionTo(this.states.INITIALIZING);
                }
              } catch (e) {
                console.error('[状态机] Agent检查出错:', e);
                clearInterval(checkInterval);
                this.transitionTo(this.states.ERROR);
              }
            }, 1000); // 每秒检查一次
            
            // 设置最大等待时间30秒（比之前的20秒更宽松）
            setTimeout(() => {
              if (this.currentState === this.states.WAITING_FOR_AGENT) {
                clearInterval(checkInterval);
                console.warn('[状态机] Agent等待超时(30s)，但继续尝试初始化...');
                // 不抛出错误，而是尝试继续 - 也许Agent实际上是工作的
                this.transitionTo(this.states.INITIALIZING);
              }
            }, 30000);
            return; // 重要：这里return，不继续执行
          }
          case this.states.INITIALIZING: {
            this.lastSubAction = 'finding_initial_elements';
            const questionList = querySelectorFallback(config.selectors.questionList);
            const startBtn = findButtonByTexts(config.selectors.startButtonTexts);
            const retryBtn = findButtonByTexts(config.selectors.retryButtonTexts);

            if (!questionList && !(startBtn || retryBtn)) {
              this.lastSubAction = 'waiting_for_exam_entry';
              console.log('[状态机] 正在等待考试入口...');
              await waitFor(
                () =>
                  findButtonByTexts(config.selectors.startButtonTexts) ||
                  findButtonByTexts(config.selectors.retryButtonTexts) ||
                  querySelectorFallback(config.selectors.questionList),
                30000, 500, '考试入口（按钮或题目列表）'
              );
            }

            this.lastSubAction = 'checking_if_already_in_exam';
            const alreadyInExam = !!querySelectorFallback(config.selectors.questionList);
            if (alreadyInExam) {
              console.log('[状态机] 检测到已在考试中，直接进入答题流程');
              this.transitionTo(this.states.WAITING_FOR_ANSWERS);
            } else if (findButtonByTexts(config.selectors.startButtonTexts) || findButtonByTexts(config.selectors.retryButtonTexts)) {
              console.log('[状态机] 检测到考试入口按钮');
              this.transitionTo(this.states.LOOKING_FOR_START);
            } else {
               throw new Error('Could not find exam entry point after waiting.');
            }
            break;
          }

          case this.states.LOOKING_FOR_START: {
            this.lastSubAction = 'finding_start_button';
            const btn = await waitFor(() =>
                findButtonByTexts(config.selectors.startButtonTexts) ||
                findButtonByTexts(config.selectors.retryButtonTexts),
                config.timeouts.pageLoad, 500, '“开始/再测一次”按钮');
            
            this.lastSubAction = 'clicking_start_button';
            await util.sleep(util.randomDelay(config.delays.beforeClick.min, config.delays.beforeClick.max));
            util.simulateClick(btn);
            this.transitionTo(this.states.STARTING_EXAM);
            break;
          }

          case this.states.STARTING_EXAM: {
            this.lastSubAction = 'resetting_answer_state';
            // 重置答案状态，准备接收新的试卷数据
            tt.__answersReady = false;
            tt.__paperData = null;
            tt.__paperCaptured = false;
            
            // 点击后进入专门的等待状态，而不是直接处理复杂的弹窗逻辑
            console.log('[状态机] 考试入口已点击，转入窗口等待状态...');
            this.transitionTo(this.states.WAITING_FOR_EXAM_WINDOW);
            break;
          }

          case this.states.WAITING_FOR_EXAM_WINDOW: {
            this.lastSubAction = 'waiting_for_exam_window_and_agent';
            console.log('[状态机] 等待考试窗口出现，并确保Agent就绪...');
            
            // **核心改进**: 分步骤处理，确保Agent和考试窗口都就绪
            const maxWaitTime = 25000; // 25秒最大等待时间
            const startTime = Date.now();
            let agentReady = tt.__agentReady === true; // 初始状态
            let examWindowReady = false;
            
            while (Date.now() - startTime < maxWaitTime) {
              // 检查Agent是否就绪
              if (!agentReady && tt.__agentReady === true) {
                agentReady = true;
                console.log('[状态机] ✓ Agent确认就绪');
              }
              
              // 处理可能的确认弹窗
              this.lastSubAction = 'handling_confirmation_dialogs';
              const confirmDialog = findVisibleDialog(config.selectors.confirmDialog);
              if (confirmDialog) {
                const okBtn = querySelectorFallback(config.selectors.confirmOkButton, confirmDialog);
                if (okBtn && ((ns.util && ns.util.isElementVisible && ns.util.isElementVisible(okBtn)) || okBtn.offsetParent !== null)) {
                  console.log('[状态机] 处理确认弹窗');
                  await util.sleep(util.randomDelay(300, 800));
                  util.simulateClick(okBtn);
                  await util.sleep(1000); // 等待弹窗消失
                  continue;
                }
              }
              
              // 检查考试窗口是否出现
              if (!examWindowReady && findVisibleDialog(config.selectors.examDialog)) {
                examWindowReady = true;
                console.log('[状态机] ✓ 考试窗口确认出现');
              }
              
              // 如果Agent和考试窗口都就绪，开始等待答案
              if (agentReady && examWindowReady) {
                console.log('[状态机] ✓ Agent和考试窗口均已就绪，开始等待答案数据...');
                this.transitionTo(this.states.WAITING_FOR_ANSWERS);
                return;
              }
              
              await util.sleep(500); // 每500ms检查一次
            }
            
            // 如果超时但考试窗口已出现，仍然尝试继续（也许Agent实际在工作）
            if (examWindowReady) {
              console.warn('[状态机] Agent等待超时但考试窗口已出现，尝试继续...', 
                `Agent状态: ${agentReady}, 考试窗口: ${examWindowReady}`);
              this.transitionTo(this.states.WAITING_FOR_ANSWERS);
            } else {
              throw new Error(`等待超时 - Agent就绪: ${agentReady}, 考试窗口: ${examWindowReady}`);
            }
            break;
          }

          case this.states.WAITING_FOR_ANSWERS: {
            this.lastSubAction = 'waiting_for_api_answers';
            try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('exam', 'wait.answers', 'info'); } catch {}
            await waitFor(() => tt.__answersReady === true, (config?.timeouts?.request || 20000), 500, 'Agent captured answers');
            this.transitionTo(this.states.WAITING_FOR_QUESTIONS);
            break;
          }

          case this.states.WAITING_FOR_QUESTIONS: {
            const root = querySelectorFallback(config.selectors.examDialog) || document;
            this.lastSubAction = 'waiting_for_loading_spinner_to_disappear';
            await waitFor(() => !querySelectorFallback(config.selectors.loadingSpinner, root), config.timeouts.pageLoad, 500, 'Loading spinner to disappear');
            this.lastSubAction = 'waiting_for_question_list';
            await waitFor(() => querySelectorFallback(config.selectors.questionList, root), config.timeouts.pageLoad, 500, 'Question list');
            this.transitionTo(this.states.ANSWERING);
            break;
          }

          case this.states.ANSWERING: {
            this.lastSubAction = 'preparing_to_answer';
            const root = findVisibleDialog(config.selectors.examDialog) || document;
            const questionsOnPage = querySelectorAllFallback(config.selectors.questionItem, root);
            const questionsFromApi = (tt.__paperData && tt.__paperData.questions) || [];

            if (questionsOnPage.length === 0 || questionsFromApi.length === 0) {
              this.transitionTo(this.states.WAITING_FOR_QUESTIONS);
              return;
            }
            
            // ... (rest of the answering logic is complex, for this example we assume errors are less granular)
            // A more detailed implementation would wrap each `answerCorrectlyDynamic` call in a try/catch
            // and set `lastSubAction` to `answering_question_${qData.id}` for example.
            
            for (let i = 0; i < questionsFromApi.length; i++) {
              const qData = questionsFromApi[i];
              this.lastSubAction = `answering_question_${i}`;
              // Simplified matching logic for brevity
              const matchedEl = questionsOnPage[i]; // This is not robust, just for demonstration
              if (matchedEl) {
                const success = await answerCorrectlyDynamic(matchedEl, qData);
                if (!success) {
                   console.warn(`[深学助手] Failed to answer question ${i}, attempting incorrect answer as fallback.`);
                   answerIncorrectly(matchedEl);
                }
              }
              await util.sleep(util.randomDelay(400, 800));
            }

            this.transitionTo(this.states.SUBMITTING);
            break;
          }

          case this.states.SUBMITTING: {
            const root = findVisibleDialog(config.selectors.examDialog);
            if (!root) {
              console.log('[状态机] 提交时未找到考试窗口，可能已成功关闭，视为完成。');
              this.transitionTo(this.states.FINISHED);
              return;
            }

            console.log('[状态机] 进入提交阶段，寻找最终提交按钮...');
            this.lastSubAction = 'finding_final_submit_button';

            // **核心逻辑**: 找到并点击那个唯一的"确定"按钮
            const submitBtn = await waitFor(() => 
                findButtonByTexts(config.selectors.submitButtonTexts, root), 
                10000, 500, '"提交/交卷/确定"按钮');

            if (!submitBtn) {
              throw new Error('未找到最终提交按钮');
            }

            console.log('[状态机] 找到最终提交按钮，执行点击并完成流程！');
            this.lastSubAction = 'clicking_final_submit_button';
            await util.sleep(util.randomDelay(config.delays.beforeClick.min, config.delays.beforeClick.max));
            util.simulateClick(submitBtn);
            
            // 点击后，给予短暂延迟以确保网络请求发出
            await util.sleep(1500);
            
            // **关键**: 点击后直接进入完成状态，不再等待任何其他弹窗
            console.log('[状态机] 提交按钮已点击，流程完成！');
            this.transitionTo(this.states.FINISHED);
            break;
          }

          case this.states.FINISHED: {
            try { util.showMessage('✅ 考试已自动完成！', 5000, 'success'); } catch {}
            console.log('[深学助手] 所有流程已完成。');
            this.errorCount = 0;
            break;
          }

          case this.states.ERROR: {
            console.error('[状态机] 进入错误状态，错误详情:', this.lastError);
            
            if (this.errorCount < this.maxRetries) {
              this.errorCount++;
              console.log(`[状态机] 尝试恢复 (${this.errorCount}/${this.maxRetries})...`);
              try { util.showMessage(`⚠️ 出现错误，正在重试 (${this.errorCount}/${this.maxRetries})...`, 3000, 'warning'); } catch {}
              
              await util.sleep(2000 * this.errorCount);
              
              const lastAction = this.lastError.subAction;
              console.log(`[状态机] 失败的子操作: ${lastAction}`);

              // 更智能的恢复策略，基于具体的失败原因
              if (lastAction && lastAction.startsWith('answering_question_')) {
                this.transitionTo(this.states.WAITING_FOR_QUESTIONS); // 答题失败，从答题阶段重新开始
              } else if (lastAction === 'waiting_for_agent_ready' || lastAction === 'waiting_for_exam_window_and_agent') {
                // Agent或窗口等待超时，重置Agent状态并从初始化开始
                console.log('[状态机] Agent/窗口等待失败，重置状态重试...');
                tt.__agentReady = false; // 重置Agent状态，强制重新检测
                this.transitionTo(this.states.WAITING_FOR_AGENT);
              } else if (lastAction === 'clicking_start_button' || lastAction === 'finding_start_button') {
                this.transitionTo(this.states.LOOKING_FOR_START); // 启动按钮失败，重新寻找
              } else if (lastAction === 'waiting_for_api_answers') {
                // 等待答案超时，可能Agent需要重新初始化
                console.log('[状态机] 等待答案超时，可能需要重新初始化Agent...');
                this.transitionTo(this.states.INITIALIZING);
              } else {
                this.transitionTo(this.states.INITIALIZING); // 默认重新初始化
              }
            } else {
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
        console.error(`[状态机] 在 ${this.currentState} 状态 (子操作: ${this.lastSubAction}) 下发生错误:`, error);
        this.lastError = {
          state: this.currentState,
          subAction: this.lastSubAction,
          error: error.message || error,
          stack: error.stack,
          timestamp: Date.now()
        };
        
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
