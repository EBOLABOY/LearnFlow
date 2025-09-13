// src/sites/0755tt/exam.js

(() => {
  const ns = (window.DeepLearn ||= {});
  const util = ns.util || {};
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  const AGENT_ID = (ns.consts && ns.consts.AGENT_ID) || 'deeplearn-exam-agent';
  const ORIGIN = window.location.origin;

  // --- 通用辅助函数 ---
  const sleep = util.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const showMessage = util.showMessage || ((msg) => console.log('[深学助手]', msg));
  
  // 不再自动点击“开始测试”，仅监听与等待
  
  // --- Agent 通信 ---
  tt.__paperData = null;
  tt.__answersReady = false;
  tt.__paperCaptured = false;

  // 监听来自Agent和CDP的消息
  const messageHandler = (message) => {
    try {
      const { type, payload, source } = message;
      if (source !== AGENT_ID) return; // 只处理我们自己的Agent消息
      if (type === 'EXAM_PAPER_RECEIVED' && !tt.__paperCaptured) {
        tt.__paperData = payload.raw; // 保存完整的原始响应
        tt.__answersReady = Array.isArray(payload.questions) && payload.questions.length > 0;
        tt.__paperCaptured = tt.__answersReady;
        console.log('[深学助手] 已通过Agent拦截到试卷数据，题目数:', payload.questions.length);
        showMessage('✅ 已获取试卷答案，准备提交', 3000, 'success');
      }
    } catch (e) {
      console.error('[深学助手] 处理Agent消息时出错:', e);
    }
  };
  
  // 监听来自注入脚本的消息
  window.addEventListener('message', (event) => {
      if (event.source === window && event.data) {
          messageHandler(event.data);
      }
  });

  // 监听来自后台CDP的消息
  try {
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message && message.source === AGENT_ID) {
          messageHandler(message);
        }
      });
    }
  } catch {}

  // --- 简化的状态机 ---
  const Machine = {
    states: {
      IDLE: 'IDLE',
      STARTING: 'STARTING',
      WAITING_FOR_PAPER: 'WAITING_FOR_PAPER',
      PREPARING_SUBMIT: 'PREPARING_SUBMIT',
      SUBMITTING_API: 'SUBMITTING_API',
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
      case this.states.STARTING: {
            // 重置状态并开始监听，用户将手动点击“开始测试”
            tt.__paperData = null;
            tt.__answersReady = false;
            tt.__paperCaptured = false;
            showMessage('请点击“开始测试”。已开始监听试卷数据...', 3000, 'info');
            this.transitionTo(this.states.WAITING_FOR_PAPER);
            break;
          }

          case this.states.WAITING_FOR_PAPER: {
            // 用户手动点击后，Agent 将拦截试卷数据；此处耐心等待
            const start = Date.now();
            const maxWait = 10 * 60 * 1000; // 最长等待10分钟，避免误超时
            while (!tt.__answersReady && (Date.now() - start) < maxWait) {
              await sleep(300);
            }
            if (!tt.__answersReady) {
              throw new Error('等待试卷数据超时，请重试或刷新页面');
            }
            this.transitionTo(this.states.PREPARING_SUBMIT);
            break;
          }

          case this.states.PREPARING_SUBMIT: {
            // 计算随机延迟时间(45-75秒)
            const randomSubmitDelay = util.randomDelay ? util.randomDelay(45000, 75000) : (Math.random() * 30000 + 45000);

            // 显示进度条
            if (util.ProgressBarManager?.create) {
              util.ProgressBarManager.create(randomSubmitDelay, '正在模拟答题过程，请稍候...');
            }

            // 等待延迟时间
            await sleep(randomSubmitDelay);

            // 清理进度条
            if (util.ProgressBarManager?.destroy) {
              util.ProgressBarManager.destroy();
            }

            // 转移到提交状态
            this.transitionTo(this.states.SUBMITTING_API);
            break;
          }

          case this.states.SUBMITTING_API: {
            const paperData = tt.__paperData && tt.__paperData.data;
            if (!paperData || !paperData.questions) {
              throw new Error('获取到的试卷数据无效');
            }

            // --- 人性化答错策略开始 ---

            // 1. 加载并合并配置
            const siteDefaultConfig = (tt.examConfig?.answering?.humanize) || { enabled: false, minWrong: 0, maxWrong: 1 };
            const userConfig = await new Promise(resolve => {
                try {
                  chrome.storage.sync.get('automationConfig', data => resolve(data.automationConfig));
                } catch (_) { resolve(null); }
            });

            let effectiveConfig = { ...siteDefaultConfig };

            // 优先检查总开关
            if (userConfig && typeof userConfig.humanizeEnabled === 'boolean') {
                effectiveConfig.enabled = userConfig.humanizeEnabled;

                // 如果总开关启用，再检查范围配置
                if (userConfig.humanizeEnabled && userConfig.wrongAnswerRange) {
                    effectiveConfig.minWrong = userConfig.wrongAnswerRange.min;
                    effectiveConfig.maxWrong = userConfig.wrongAnswerRange.max;
                }
            } else if (userConfig?.wrongAnswerRange && typeof userConfig.wrongAnswerRange.min === 'number') {
                // 向后兼容：如果没有总开关但有范围配置，则根据范围判断
                effectiveConfig.enabled = userConfig.wrongAnswerRange.min > 0 || userConfig.wrongAnswerRange.max > 0;
                effectiveConfig.minWrong = userConfig.wrongAnswerRange.min;
                effectiveConfig.maxWrong = userConfig.wrongAnswerRange.max;
            }

            // 2. 如果策略启用，则计算要答错的题目
            let indicesToFail = new Set();
            const questions = paperData.questions;

            if (effectiveConfig.enabled && questions.length > 0) {
                const eligibleIndices = questions
                    .map((q, index) => ({ type: q.type, index }))
                    .filter(item => item.type === '1' || item.type === '2')
                    .map(item => item.index);

                console.log(`[深学助手] 候选答错池 (单选/判断题) 共有 ${eligibleIndices.length} 道。`);

                let min = Math.max(0, effectiveConfig.minWrong);
                let max = Math.max(min, effectiveConfig.maxWrong);

                max = Math.min(max, eligibleIndices.length);
                min = Math.min(min, max);

                const numToFail = (min === max) ? min :
                    (util.randomDelay ? util.randomDelay(min, max) : Math.floor(Math.random() * (max - min + 1)) + min);

                if (numToFail > 0 && eligibleIndices.length > 0) {
                    const shuffledIndices = eligibleIndices.sort(() => 0.5 - Math.random());
                    for (let i = 0; i < numToFail; i++) {
                        indicesToFail.add(shuffledIndices[i]);
                    }
                }
                console.log(`[深学助手] 人性化策略：本次将从单选/判断题中答错 ${indicesToFail.size} 道题。`);
            } else {
                console.log('[深学助手] 人性化策略：未启用或配置无效，全部按正确答案提交。');
            }

            // 3. 智能生成错误答案的辅助函数
            function makeWrongAnswer(q) {
                const type = String(q.type || '').trim();
                const rawAns = (q.answer == null ? '' : String(q.answer)).trim();
                const upper = rawAns.toUpperCase();

                // 判断题：简单取反
                if (type === '1') {
                    if (upper === 'A') return 'B';
                    if (upper === 'B') return 'A';
                    if (upper === 'T' || upper === 'TRUE' || upper === '✔' || upper === '√') return 'F';
                    if (upper === 'F' || upper === 'FALSE' || upper === '✘' || upper === '×') return 'T';
                    if (upper === '1') return '0';
                    if (upper === '0') return '1';
                    if (rawAns === '正确') return '错误';
                    if (rawAns === '错误') return '正确';
                    return upper === 'A' ? 'B' : 'A';
                }

                // 单选题：从选项集合中挑不同于正确答案的一项
                const allOptions = (Array.isArray(q.options) && q.options.length)
                    ? q.options.map(opt => String(opt.key || opt.value || opt).toUpperCase())
                    : ['A','B','C','D'];
                const incorrect = allOptions.filter(k => k !== upper);
                if (incorrect.length > 0) return incorrect[Math.floor(Math.random() * incorrect.length)];
                return (allOptions[0] && allOptions[0] !== upper) ? allOptions[0] : (allOptions[1] || 'A');
            }

            // 4. 构建包含人性化逻辑的 Payload
            const payload = {
                id: paperData.id,
                type: 2,
                questions: questions.map((q, index) => {
                    let finalUserAnswer = q.answer;

                    if (indicesToFail.has(index)) {
                        finalUserAnswer = makeWrongAnswer(q);
                        console.log(` -> 题目 ${index + 1} (${q.type === '1' ? '判断题' : '单选题'}) 已故意答错。正确: ${q.answer}, 提交: ${finalUserAnswer}`);
                    }

                    const questionPayload = {
                        id: q.id,
                        userAnswer: finalUserAnswer,
                        type: q.type,
                        value: q.type === '1' ? '判断题' : (q.type === '2' ? '单选题' : '多选题')
                    };
                    if (q.type === '3') {
                        questionPayload.index = String(index);
                    }
                    return questionPayload;
                })
            };

            // --- 人性化答错策略结束 ---

            // 命令 Agent 提交
            window.postMessage({
              target: AGENT_ID,
              command: 'SUBMIT_ANSWERS',
              payload: payload
            }, ORIGIN);

            // 等待 Agent 的提交结果
            await new Promise((resolve, reject) => {
              const resultHandler = (event) => {
                if (event.source === window && event.data && event.data.source === AGENT_ID) {
                  if (event.data.type === 'SUBMIT_SUCCESS') {
                    window.removeEventListener('message', resultHandler);
                    resolve(event.data.payload);
                  } else if (event.data.type === 'SUBMIT_ERROR') {
                    window.removeEventListener('message', resultHandler);
                    reject(new Error(event.data.payload));
                  }
                }
              };
              window.addEventListener('message', resultHandler);
              setTimeout(() => {
                window.removeEventListener('message', resultHandler);
                reject(new Error('提交答案超时'));
              }, 15000);
            });

            this.transitionTo(this.states.FINISHED);
            break;
          }

          case this.states.FINISHED: {
            showMessage('✅ 考试已通过API快速提交！', 5000, 'success');
            console.log('[深学助手] 考试流程结束。');
            // 刷新页面查看结果
            await sleep(2000);
            location.reload();
            break;
          }

          case this.states.ERROR: {
            // 确保清理进度条
            if (util.ProgressBarManager?.destroy) {
              util.ProgressBarManager.destroy();
            }
            const errorMessage = this.lastError?.message || '未知错误';
            showMessage(`❌ 自动化出错: ${errorMessage}`, 8000, 'error');
            console.error('[状态机] 进入错误状态:', this.lastError);
            break;
          }
        }
      } catch (error) {
        this.lastError = error;
        this.transitionTo(this.states.ERROR);
      }
    },
  };

  // 扩展入口
  tt.initExam = function initExam() {
    console.log('[深学助手] 启动简化的考试控制器...');
    tt.__running = true;
    Machine.transitionTo(Machine.states.STARTING);
  };
})();
