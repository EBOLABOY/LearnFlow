const fs = require('fs');
const path = require('path');

// Helper to inject code into jsdom window context
function evalInWindow(code) {
  // Use indirect eval to ensure execution in global (window) scope
  // eslint-disable-next-line no-eval
  return window.eval(code);
}

describe('answerCorrectlyDynamic multi-select behavior', () => {
  jest.setTimeout(10000);

  beforeAll(() => {
    // Prepare DeepLearn namespace and minimal util stubs
    window.DeepLearn = window.DeepLearn || {};
    const ns = window.DeepLearn;
    ns.util = ns.util || {};
    ns.util.isElementVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    // Simulate click by toggling 'is-checked' class; for checkbox just toggle
    ns.util.simulateClick = (el) => {
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      if (el.classList.contains('el-checkbox')) {
        el.classList.toggle('is-checked');
      } else if (el.matches('label[role="radio"], .el-radio')) {
        // emulate radio: uncheck siblings in same container
        const container = el.parentElement || document;
        container.querySelectorAll('label[role="radio"], .el-radio').forEach((n) => {
          if (n !== el) n.classList.remove('is-checked');
        });
        el.classList.add('is-checked');
      }
    };

    //  ↓↓↓  添加缺失的模拟函数  ↓↓↓
    ns.util.randomDelay = async (min, max) => {
      // Mock implementation for testing - no actual delay needed
      return Promise.resolve();
    };

    // Minimal site namespace and config used by exam.js
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
    };

    // Load exam.js and export answerCorrectlyDynamic onto window for testing
    const examPath = path.join(__dirname, '..', 'src', 'sites', '0755tt', 'exam.js');
    let code = fs.readFileSync(examPath, 'utf-8');
    // Inject an export inside the IIFE by replacing the last '})();'
    const marker = '})();';
    const lastIdx = code.lastIndexOf(marker);
    if (lastIdx !== -1) {
      code = code.slice(0, lastIdx) +
        '\n;window.__answerCorrectlyDynamic = answerCorrectlyDynamic;\n' +
        code.slice(lastIdx);
    } else {
      // Fallback: just append export (works if not wrapped)
      code += '\n;window.__answerCorrectlyDynamic = answerCorrectlyDynamic;\n';
    }
    evalInWindow(code);
  });

  test('selects all correct checkboxes with delays between clicks', async () => {
    const container = document.createElement('div');
    container.id = 'q1';
    // Create 4 checkbox options
    for (let i = 0; i < 4; i++) {
      const opt = document.createElement('label');
      opt.className = 'el-checkbox';
      container.appendChild(opt);
    }
    document.body.appendChild(container);

    // Provide paper data: multi-select, correct indices A and C => 0 and 2
    const tt = window.DeepLearn.sites.tt0755;
    tt.__paperData = { questions: [{ type: '3', answer: 'A,C' }] };

    const fn = window.__answerCorrectlyDynamic;
    expect(typeof fn).toBe('function');
    const ok = await fn(container, tt.__paperData.questions[0]);
    expect(ok).toBe(true);

    const opts = Array.from(container.querySelectorAll('label.el-checkbox'));
    const checked = opts.map((o, i) => (o.classList.contains('is-checked') ? i : -1)).filter((i) => i >= 0);
    expect(checked.sort()).toEqual([0, 2]);
  });
});

