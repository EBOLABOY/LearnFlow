const fs = require('fs');
const path = require('path');

// Evaluate code in jsdom window scope
function evalInWindow(code) {
  // eslint-disable-next-line no-eval
  return window.eval(code);
}

describe('exam flow uses agent messaging and API submit', () => {
  jest.setTimeout(10000);

  beforeAll(() => {
    // Ensure util is attached (side-effect module)
    require('../src/util.js');

    // Speed up delays for tests
    const util = window.DeepLearn.util;
    util.randomDelay = () => 5;
    util.sleep = async () => {};
    // No-op progress UI
    util.ProgressBarManager = {
      create: jest.fn(),
      destroy: jest.fn(),
    };

    // Provide constants namespace
    window.DeepLearn.consts = window.DeepLearn.consts || {};
    window.DeepLearn.consts.AGENT_ID = 'deeplearn-exam-agent';

    // Mock chrome.runtime listener registration (not used directly here but present in code)
    global.chrome = {
      runtime: {
        onMessage: { addListener: jest.fn() },
      },
    };

    // Load and evaluate the exam module
    const examPath = path.join(__dirname, '..', 'src', 'sites', '0755tt', 'exam.js');
    const code = fs.readFileSync(examPath, 'utf-8');
    evalInWindow(code);
  });

  test('end-to-end state machine posts SUBMIT_ANSWERS then finishes on SUBMIT_SUCCESS', async () => {
    const tt = window.DeepLearn.sites.tt0755;
    expect(typeof tt.initExam).toBe('function');

    // Spy and intercept postMessage to simulate Agent submission
    const originalPost = window.postMessage.bind(window);
    const postSpy = jest.spyOn(window, 'postMessage').mockImplementation((msg, origin) => {
      // Validate outgoing command
      if (msg && msg.command === 'SUBMIT_ANSWERS') {
        expect(msg.target).toBe('deeplearn-exam-agent');
        expect(msg.payload).toBeTruthy();
        expect(Array.isArray(msg.payload.questions)).toBe(true);
        // Respond with SUBMIT_SUCCESS
        const success = new window.MessageEvent('message', {
          data: { source: 'deeplearn-exam-agent', type: 'SUBMIT_SUCCESS', payload: { ok: true } },
          origin: window.location.origin,
          source: window,
        });
        window.dispatchEvent(success);
      } else {
        // Allow any other messages (if any)
        originalPost(msg, origin);
      }
    });


    // Kick off the flow
    tt.initExam();

    // Simulate agent delivering paper data
    const paper = {
      data: {
        id: 'paper-1',
        questions: [
          { id: 'q1', type: '2', answer: 'A' },
          { id: 'q2', type: '1', answer: 'T' },
          { id: 'q3', type: '3', answer: 'A,B' },
        ],
      },
    };
    const receive = new window.MessageEvent('message', {
      data: {
        source: 'deeplearn-exam-agent',
        type: 'EXAM_PAPER_RECEIVED',
        payload: { raw: paper, questions: paper.data.questions },
      },
      origin: window.location.origin,
      source: window,
    });
    window.dispatchEvent(receive);

    // Allow microtasks to settle
    await Promise.resolve();
    await Promise.resolve();

    // We expect a submit to have been initiated
    expect(postSpy).toHaveBeenCalled();

    postSpy.mockRestore();
  });
});
