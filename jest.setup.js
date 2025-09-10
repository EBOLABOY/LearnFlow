// Polyfill innerText for jsdom
if (!Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'innerText')) {
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() { return this.textContent; },
    set(v) { this.textContent = v; },
  });
}

// Global setup for DeepLearn namespace and utilities
beforeAll(() => {
  window.DeepLearn = window.DeepLearn || {};
  const ns = window.DeepLearn;

  // Mock utility functions
  ns.util = ns.util || {};
  ns.util.isElementVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };
  ns.util.simulateClick = (el) => {
    if (!el) return; // Guard against null element
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    if (el.classList.contains('el-checkbox')) {
      el.classList.toggle('is-checked');
    } else if (el.matches('label[role="radio"], .el-radio')) {
      const container = el.parentElement || document;
      container.querySelectorAll('label[role="radio"], .el-radio').forEach((n) => {
        if (n !== el) n.classList.remove('is-checked');
      });
      el.classList.add('is-checked');
    }
  };
  ns.util.randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
  ns.util.sleep = async (ms) => Promise.resolve(); // Also mock sleep

  // Mock site-specific config
  ns.sites = ns.sites || {};
  ns.sites.tt0755 = ns.sites.tt0755 || {};
  ns.sites.tt0755.examConfig = {
    selectors: {
      radioOption: ['label[role="radio"]', '.el-radio'],
      checkboxOption: ['label.el-checkbox', '[role="group"] .el-checkbox'],
      radioLabel: ['.el-radio__label'],
      checkboxLabel: ['.el-checkbox__label'],
    },
    timeouts: { pageLoad: 1000, request: 1000 },
    delays: {
      beforeClick: { min: 10, max: 30 },
      afterClick: { min: 10, max: 30 },
      answerNormal: { min: 10, max: 20 },
      answerComplex: { min: 10, max: 20 },
    },
    answering: {
      judge: {
        mode: 'text', // or 'index'
        trueIndex: 0,
        falseIndex: 1,
        allowTextFallback: true,
      },
    },
  };
  
  // Test-only helper: provide answerCorrectlyDynamic for unit tests
  // This mirrors the previous UI-answering behavior sufficiently for tests.
  window.answerCorrectlyDynamic = async function(qEl, qData) {
    try {
      if (!qEl || !qData) return false;
      const util = window.DeepLearn.util || {};
      const cfg = window.DeepLearn.sites?.tt0755?.examConfig || {};
      const type = String(qData.type || '');
      const ansStr = String(qData.answer || '').trim().toUpperCase();

      // Judgment (T/F)
      if (type === '1') {
        const radios = Array.from(qEl.querySelectorAll('label[role="radio"], .el-radio'));
        if (radios.length < 2) return false;
        const judgeCfg = (cfg.answering && cfg.answering.judge) || { mode: 'index', trueIndex: 0, falseIndex: 1, allowTextFallback: true };
        let idx = -1;
        if (judgeCfg.mode === 'index') {
          idx = ansStr === 'T' ? (Number.isFinite(judgeCfg.trueIndex) ? judgeCfg.trueIndex : 0) : (Number.isFinite(judgeCfg.falseIndex) ? judgeCfg.falseIndex : 1);
        } else {
          const targetText = ansStr === 'T' ? '正确' : '错误';
          idx = radios.findIndex(el => String(el.textContent || '').includes(targetText));
        }
        if (idx < 0 || idx >= radios.length) idx = ansStr === 'T' ? 0 : 1;
        util.simulateClick && util.simulateClick(radios[idx]);
        return true;
      }

      // Single / Multi by indices A,B,C...
      const isMulti = type === '3';
      const options = Array.from(qEl.querySelectorAll(isMulti ? 'label.el-checkbox, .el-checkbox' : 'label[role="radio"], .el-radio'));
      if (!options.length) return false;
      const indices = Array.from(new Set(ansStr.split(',').map(s => {
        const c = String(s).trim()[0];
        if (!c) return -1;
        const code = c.charCodeAt(0) - 'A'.charCodeAt(0);
        return code >= 0 && code < 26 ? code : -1;
      }).filter(i => i >= 0)));
      if (!indices.length) return false;
      if (isMulti) {
        indices.forEach(i => { if (i < options.length) util.simulateClick && util.simulateClick(options[i]); });
      } else {
        const i = indices[0];
        util.simulateClick && util.simulateClick(options[Math.min(Math.max(i, 0), options.length - 1)]);
      }
      return true;
    } catch {
      return false;
    }
  };
});
