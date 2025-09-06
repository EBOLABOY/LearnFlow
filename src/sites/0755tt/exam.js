(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});
  const { questionBank } = tt;

  // Exam controller using MutationObserver (UTF‑8 clean)
  tt.initExam = function initExam() {
    console.log('[深学助手] Exam Controller 初始化中...');
    // 标记运行状态供弹窗查询
    tt.__running = true;

    // 从选项页加载答题延迟（秒），默认 2 秒
    let answerDelaySec = 2;
    try {
      chrome.storage?.sync?.get({ automationConfig: { answerDelay: 2 } }, (data) => {
        const cfg = (data && data.automationConfig) || {};
        if (typeof cfg.answerDelay === 'number' && cfg.answerDelay > 0) answerDelaySec = cfg.answerDelay;
      });
    } catch (_) {}

    // Utils
    function simulateClick(el) {
      if (!el) return;
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']
        .forEach((type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })));
    }

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function waitForElement(selector, parent = document, timeout = 30000) {
      return new Promise((resolve, reject) => {
        const found = parent.querySelector(selector);
        if (found) return resolve(found);
        const obs = new MutationObserver(() => {
          const el = parent.querySelector(selector);
          if (el) { obs.disconnect(); resolve(el); }
        });
        obs.observe(parent, { childList: true, subtree: true, attributes: true });
        setTimeout(() => { obs.disconnect(); reject(new Error(`等待元素超时: ${selector}`)); }, timeout);
      });
    }

    function waitForVisible(selector, timeout = 30000) {
      return new Promise((resolve, reject) => {
        const test = () => {
          const el = document.querySelector(selector);
          if (el && el.offsetParent !== null && getComputedStyle(el).display !== 'none') return el;
          return null;
        };
        const hit = test();
        if (hit) return resolve(hit);
        const obs = new MutationObserver(() => {
          const el = test();
          if (el) { obs.disconnect(); resolve(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class'] });
        setTimeout(() => { obs.disconnect(); reject(new Error(`等待元素可见超时: ${selector}`)); }, timeout);
      });
    }

    function answerIncorrectly(qEl) {
      const checks = qEl.querySelectorAll('.el-checkbox');
      const radios = qEl.querySelectorAll('.el-radio');
      if (checks.length > 0) {
        simulateClick(checks[Math.floor(Math.random() * checks.length)]);
      } else if (radios.length > 0) {
        simulateClick(radios[Math.floor(Math.random() * radios.length)]);
      }
    }

    function answerCorrectly(qEl, index) {
      const titleEl = qEl.querySelector('.subject-title');
      if (!titleEl) {
        console.warn(`[深学助手] 第 ${index + 1} 题未找到题目标题元素`);
        return;
      }
      const text = titleEl.innerText.trim();
      const ans = questionBank && questionBank.get ? questionBank.get(text) : null;
      if (!ans) {
        console.warn(`[深学助手] 警告：题库中未找到问题 "${text}"，随机作答`);
        return answerIncorrectly(qEl);
      }

      const checks = qEl.querySelectorAll('.el-checkbox');
      const radios = qEl.querySelectorAll('.el-radio');
      if (checks.length > 0) {
        const letters = ans.split(',');
        checks.forEach(cb => {
          const label = cb.querySelector('.el-checkbox__label');
          if (!label) return;
          const letter = label.innerText.trim().substring(0,1);
          if (letters.includes(letter) && !cb.classList.contains('is-checked')) simulateClick(cb);
        });
      } else if (radios.length > 0) {
        let targetText;
        if (ans === 'T') targetText = '正确';
        else if (ans === 'F') targetText = '错误';
        else targetText = ans + '.';
        radios.forEach(r => {
          const label = r.querySelector('.el-radio__label');
          if (label && label.innerText.trim().startsWith(targetText) && !r.classList.contains('is-checked')) simulateClick(r);
        });
      }
    }

    async function submitConfirmIfPresent() {
      // 查找弹窗中的“确定”按钮
      const dialog = document.querySelector('.el-dialog__wrapper:not(.preview)');
      if (!dialog) return false;
      const ok = Array.from(dialog.querySelectorAll('.el-dialog__footer button span'))
        .find(span => span.innerText.trim() === '确定');
      if (ok && ok.parentElement) {
        console.log('[深学助手] 确认弹窗：点击“确定”');
        simulateClick(ok.parentElement);
        return true;
      }
      return false;
    }

    async function answerAllQuestionsAndSubmit() {
      const list = Array.from(document.querySelectorAll('.subject-item'));
      if (list.length === 0) {
        console.error('[深学助手] 未找到任何题目元素');
        return;
      }
      for (let i = 0; i < list.length; i++) {
        answerCorrectly(list[i], i);
        // 每题之间增加随机延迟，降低被检测风险
        const jitter = Math.floor(Math.random() * 400); // 0-400ms 抖动
        await sleep(answerDelaySec * 1000 + jitter);
      }

      // 点击“提交”或“交卷”
      const submitBtn = Array.from(document.querySelectorAll('button span'))
        .find(s => /提交|交卷/.test(s.innerText.trim()));
      if (submitBtn && submitBtn.parentElement) {
        console.log('[深学助手] 所有题目已作答，点击提交/交卷');
        simulateClick(submitBtn.parentElement);
        // 弹出确认
        setTimeout(submitConfirmIfPresent, 500);
      } else {
        console.warn('[深学助手] 未找到提交按钮');
      }
    }

    async function tryStartExam() {
      // 查找“开始测试”按钮
      const startBtn = Array.from(document.querySelectorAll('button span'))
        .find(s => s.innerText.trim().includes('开始测试'));
      if (startBtn && startBtn.parentElement) {
        console.log('[深学助手] 点击“开始测试”');
        simulateClick(startBtn.parentElement);
        // 等待确认对话框并点击“确定”
        setTimeout(async () => {
          const ok = await waitForElement('.el-dialog__wrapper:not(.preview) .el-dialog__footer button span');
          if (ok && ok.innerText.trim() === '确定' && ok.parentElement) simulateClick(ok.parentElement);
        }, 500);
      }
    }

    // 观察页面关键变化，以事件驱动方式触发
    const observer = new MutationObserver(() => {
      // 1) 尝试开始考试
      tryStartExam();
      // 2) 当题目区域出现且可见时，开始作答
      const paper = document.querySelector('.exam-paper, .subject-list, .subject-item');
      if (paper) {
        // 略作延时，等待布局稳定
        setTimeout(answerAllQuestionsAndSubmit, 800);
      }
      // 3) 若出现确认弹窗，尝试自动确认
      submitConfirmIfPresent();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

    console.log('[深学助手] Exam Controller 已启动');
  };
})();

