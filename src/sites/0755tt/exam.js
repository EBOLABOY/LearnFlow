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

  function normalizeLabelText(labelEl) {
    const raw = (labelEl && labelEl.innerText) ? labelEl.innerText.trim() : '';
    return raw.replace(/^\s*([A-Za-z]|[一二三四五六七八九十]|\d+)\s*[\.|、，．]\s*/u, '').trim();
  }

  function normalizeQuestionFromApi(q) {
    const out = { type: 'unknown', optionTexts: [], correctIndices: [], correctTexts: [] };
    if (!q || typeof q !== 'object') return out;

    const options = q.options || q.optionList || q.choices || q.answers || q.opts || [];
    const getText = (o) => (o && (o.text || o.content || o.title || o.name || o.label || o.optionContent || o.value)) || '';
    if (Array.isArray(options) && options.length) {
      out.optionTexts = options.map(getText).map((s) => String(s || '').trim());
      options.forEach((o, idx) => { if (o && (o.isCorrect === true || o.correct === true || o.right === true)) out.correctIndices.push(idx); });
    }

    const cand = q.correctAnswer ?? q.answer ?? q.answers ?? q.rightAnswer ?? q.realAnswer ?? q.key;
    if (cand != null && out.correctIndices.length === 0) {
      if (Array.isArray(cand)) {
        cand.forEach((v) => {
          if (typeof v === 'number') out.correctIndices.push(v);
          else if (typeof v === 'string') {
            const s = v.trim();
            if (/^[A-Za-z]$/.test(s)) out.correctIndices.push(s.toUpperCase().charCodeAt(0) - 65);
            else if (/^\d+$/.test(s)) out.correctIndices.push(parseInt(s, 10));
          }
        });
      } else if (typeof cand === 'string') {
        const s = cand.trim();
        if (s === 'T' || /^true$/i.test(s)) { out.type = 'tf'; out.correctTexts = ['正确']; }
        else if (s === 'F' || /^false$/i.test(s)) { out.type = 'tf'; out.correctTexts = ['错误']; }
        else {
          const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
          if (parts.length) {
            parts.forEach((p) => {
              if (/^[A-Za-z]$/.test(p)) out.correctIndices.push(p.toUpperCase().charCodeAt(0) - 65);
              else if (/^\d+$/.test(p)) out.correctIndices.push(parseInt(p, 10));
              else out.correctTexts.push(p);
            });
          } else {
            out.correctTexts.push(s);
          }
        }
      } else if (typeof cand === 'number') {
        out.correctIndices.push(cand);
      }
    }

    if (out.correctIndices.length && out.optionTexts.length) {
      out.correctIndices.forEach((i) => { if (out.optionTexts[i] != null) out.correctTexts.push(String(out.optionTexts[i]).trim()); });
    }

    if (out.correctTexts.length === 1 && (out.correctTexts[0] === '正确' || out.correctTexts[0] === '错误')) out.type = 'tf';
    else if (out.correctTexts.length > 1) out.type = 'multi';
    else if (out.correctTexts.length === 1) out.type = 'single';

    return out;
  }

  function answerIncorrectly(qEl) {
    const checks = querySelectorAllFallback(config.selectors.checkboxOption, qEl);
    const radios = querySelectorAllFallback(config.selectors.radioOption, qEl);
    if (checks.length > 0) util.simulateClick(checks[Math.floor(Math.random() * checks.length)]);
    else if (radios.length > 0) util.simulateClick(radios[Math.floor(Math.random() * radios.length)]);
  }

  function answerCorrectlyDynamic(qEl, index) {
    const checks = querySelectorAllFallback(config.selectors.checkboxOption, qEl);
    const radios = querySelectorAllFallback(config.selectors.radioOption, qEl);
    const q = (tt.__paperData && Array.isArray(tt.__paperData.questions)) ? tt.__paperData.questions[index] : null;
    if (!q) {
      console.warn(`[深学助手] 未获取到第${index + 1}题的动态答案，随机作答`);
      return answerIncorrectly(qEl);
    }
    const norm = normalizeQuestionFromApi(q);

    if ((checks && checks.length) > 0) {
      const want = new Set(norm.correctTexts.map((s) => String(s).trim()));
      let clicked = 0;
      checks.forEach((cb) => {
        const label = querySelectorFallback(config.selectors.checkboxLabel, cb);
        if (!label) return;
        const text = normalizeLabelText(label);
        const hit = [...want].some((w) => text.includes(w) || w.includes(text));
        if (hit && !cb.classList.contains('is-checked')) { util.simulateClick(cb); clicked++; }
      });
      if (clicked === 0) return answerIncorrectly(qEl);
    } else if ((radios && radios.length) > 0) {
      let target = null;
      const want = norm.correctTexts[0] || '';
      radios.forEach((r) => {
        const label = querySelectorFallback(config.selectors.radioLabel, r);
        if (!label || target) return;
        const text = normalizeLabelText(label);
        if (text === want || text.includes(want) || want.includes(text) || (norm.type === 'tf' && (/正确|错误/.test(text) && text.includes(want)))) {
          target = r;
        }
      });
      if (target && !target.classList.contains('is-checked')) util.simulateClick(target);
      else return answerIncorrectly(qEl);
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randomDelay = (range) => sleep(Math.floor(Math.random() * (range.max - range.min + 1) + range.min));

  function findButtonByTexts(texts, scope = document) {
    const list = Array.isArray(texts) ? texts : [texts];
    const btns = Array.from(scope.querySelectorAll('button'));
    return btns.find((b) => {
      const t = (b.innerText || '').trim();
      const enabled = !(b.disabled || b.classList?.contains('is-disabled'));
      const visible = (ns.util && typeof ns.util.isElementVisible === 'function') ? ns.util.isElementVisible(b) : true;
      return enabled && visible && list.some((s) => t.includes(s));
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
    transitionTo(newState) {
      console.log(`[状态机] ${this.currentState} -> ${newState}`);
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
            await randomDelay(config.delays.beforeClick);
            util.simulateClick(btn);
            this.transitionTo(this.states.STARTING_EXAM);
            break;
          }

          case this.states.STARTING_EXAM: {
            // Enhanced: handle multiple pre-exam dialogs until the real exam dialog appears
            tt.__answersReady = false;
            tt.__paperData = null;
            tt.__paperCaptured = false;
            {
              let attempt = 0;
              while (attempt < 3) {
                const preExamDialog = querySelectorFallback(config.selectors.confirmDialog);
                if (preExamDialog) {
                  const okBtn = querySelectorFallback(config.selectors.confirmOkButton, preExamDialog);
                  if (okBtn) {
                    await randomDelay(config.delays.beforeClick);
                    util.simulateClick(okBtn);
                    // Wait for the current pre-exam dialog to disappear
                    await waitFor(
                      () => !querySelectorFallback(config.selectors.confirmDialog),
                      5000,
                      250,
                      'pre-exam dialog close'
                    );
                    await randomDelay(config.delays.afterClick);
                  } else {
                    await sleep(1000);
                  }
                }

                // Check if the real exam dialog is now present
                const examDialog = querySelectorFallback(config.selectors.examDialog);
                if (examDialog) {
                  this.transitionTo(this.states.WAITING_FOR_ANSWERS);
                  break;
                }
                attempt++;
              }

              if (this.currentState === this.states.STARTING_EXAM) {
                throw new Error('Timeout waiting for exam dialog after pre-exam dialogs');
              }
              break;
            }
            // 每次开始考试前重置缓存的答案数据，避免使用到上一次的残留
            tt.__answersReady = false;
            tt.__paperData = null;
            tt.__paperCaptured = false;
            const description = "“开始测试”后的确认对话框";
            const dialog = await waitFor(() => querySelectorFallback(config.selectors.confirmDialog), 15000, 500, description);

            if (dialog) {
              const okBtn = querySelectorFallback(config.selectors.confirmOkButton, dialog);
              if (okBtn) {
                console.log('[状态机] 找到并点击确认对话框中的“确定”按钮');
                await randomDelay(config.delays.beforeClick);
                util.simulateClick(okBtn);
              } else {
                throw new Error('在确认对话框中没有找到主确认按钮');
              }
            }

            console.log('[状态机] “确定”已点击，现在开始等待答案和试题...');
            this.transitionTo(this.states.WAITING_FOR_ANSWERS);
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
            const root = querySelectorFallback(config.selectors.examDialog) || document;
            const questions = querySelectorAllFallback(config.selectors.questionItem, root);
            if (questions.length === 0) {
              console.warn('[深学助手] 未找到题目元素，回到等待状态');
              this.transitionTo(this.states.WAITING_FOR_QUESTIONS);
              return;
            }
            for (const [idx, qEl] of questions.entries()) {
              const isComplex = !!querySelectorFallback(config.selectors.checkboxOption, qEl);
              answerCorrectlyDynamic(qEl, idx);
              await randomDelay(isComplex ? config.delays.answerComplex : config.delays.answerNormal);
            }
            this.transitionTo(this.states.SUBMITTING);
            break;
          }

          case this.states.SUBMITTING: {
            const root = querySelectorFallback(config.selectors.examDialog) || document;
            const submitBtn = await waitFor(() => querySelectorFallback(config.selectors.submitButton, root), 10000, 500, '“提交/交卷”按钮');

            console.log('[状态机] 找到并点击“提交/交卷”按钮');
            await randomDelay(config.delays.beforeClick);
            util.simulateClick(submitBtn);

            const description = '“提交”后的最终确认对话框';
            const finalDialog = await waitFor(() => querySelectorFallback(config.selectors.confirmDialog), 15000, 500, description);

            if (finalDialog) {
              const finalOkBtn = querySelectorFallback(config.selectors.confirmOkButton, finalDialog);
              if (finalOkBtn) {
                console.log('[状态机] 找到并点击最终确认对话框中的“确定”按钮');
                await randomDelay(config.delays.beforeClick);
                util.simulateClick(finalOkBtn);
                await waitFor(
                  () => !querySelectorFallback(config.selectors.confirmDialog),
                  5000,
                  250,
                  '对话框消失'
                );
              } else {
                console.warn('[状态机] 找到了最终确认对话框，但没有找到“确定”按钮');
              }
            }

            this.transitionTo(this.states.FINISHED);
            break;
          }

          case this.states.FINISHED: {
            try {
               util.showMessage('✅ 考试已自动完成！', 5000, 'success');
            } catch {}
            console.log('[深学助手] 所有流程已完成。');
            break;
          }

          case this.states.IDLE:
          case this.states.ERROR:
          default:
            break;
        }
      } catch (error) {
        console.error(`[状态机] 在 ${this.currentState} 状态下发生错误:`, error);
        try { util.showMessage(`❌ 自动化出错: ${error.message}`, 10000, 'error'); } catch {}
        this.transitionTo(this.states.ERROR);
      }
    },
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






