const fs = require('fs');
const path = require('path');

function evalInWindow(code) {
  // eslint-disable-next-line no-eval
  return window.eval(code);
}

describe('answerCorrectlyDynamic radio and judgment', () => {
  jest.setTimeout(10000);

  beforeAll(() => {
    const examPath = path.join(__dirname, '..', 'src', 'sites', '0755tt', 'exam.js');
    let code = fs.readFileSync(examPath, 'utf-8');
    const marker = '})();';
    const lastIdx = code.lastIndexOf(marker);
    if (lastIdx !== -1) {
      code = code.slice(0, lastIdx) +
        '\n;window.__answerCorrectlyDynamic = answerCorrectlyDynamic;\n' +
        code.slice(lastIdx);
    } else {
      code += '\n;window.__answerCorrectlyDynamic = answerCorrectlyDynamic;\n';
    }
    evalInWindow(code);
  });

  test('single choice selects the correct radio (B)', async () => {
    const container = document.createElement('div');
    // Create 4 radio options
    for (let i = 0; i < 4; i++) {
      const opt = document.createElement('label');
      opt.setAttribute('role', 'radio');
      opt.className = 'el-radio';
      // label text not required for single-choice index-based logic
      const span = document.createElement('span');
      span.className = 'el-radio__label';
      span.textContent = String.fromCharCode('A'.charCodeAt(0) + i);
      opt.appendChild(span);
      container.appendChild(opt);
    }
    document.body.appendChild(container);

    const tt = window.DeepLearn.sites.tt0755;
    tt.__paperData = { questions: [{ type: '2', answer: 'B' }] };

    const fn = window.__answerCorrectlyDynamic;
    // 正确调用：直接传递题目数据对象而不是索引
    const ok = await fn(container, tt.__paperData.questions[0]);
    expect(ok).toBe(true);

    const opts = Array.from(container.querySelectorAll('label[role="radio"], .el-radio'));
    const checkedIdx = opts.findIndex((o) => o.classList.contains('is-checked'));
    expect(checkedIdx).toBe(1); // B => index 1
  });

  test('judgment selects 正确 when answer is T', async () => {
    const container = document.createElement('div');
    // Radio: 正确
    const rTrue = document.createElement('label');
    rTrue.setAttribute('role', 'radio');
    rTrue.className = 'el-radio';
    const lblTrue = document.createElement('span');
    lblTrue.className = 'el-radio__label';
    lblTrue.textContent = '正确';
    rTrue.appendChild(lblTrue);
    container.appendChild(rTrue);
    // Radio: 错误
    const rFalse = document.createElement('label');
    rFalse.setAttribute('role', 'radio');
    rFalse.className = 'el-radio';
    const lblFalse = document.createElement('span');
    lblFalse.className = 'el-radio__label';
    lblFalse.textContent = '错误';
    rFalse.appendChild(lblFalse);
    container.appendChild(rFalse);

    document.body.appendChild(container);

    const tt = window.DeepLearn.sites.tt0755;
    tt.__paperData = { questions: [{ type: '1', answer: 'T' }] };

    const fn = window.__answerCorrectlyDynamic;
    // 正确调用：直接传递题目数据对象而不是索引
    const ok = await fn(container, tt.__paperData.questions[0]);
    expect(ok).toBe(true);

    expect(rTrue.classList.contains('is-checked')).toBe(true);
    expect(rFalse.classList.contains('is-checked')).toBe(false);
  });
});
