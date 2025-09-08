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
});