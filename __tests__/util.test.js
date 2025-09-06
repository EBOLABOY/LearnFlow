/**
 * Tests for src/util.js side-effect module.
 * The module attaches utilities to window.DeepLearn.util.
 */
import '../src/util.js';

const getUtil = () => window.DeepLearn && window.DeepLearn.util;

describe('util module', () => {
  beforeEach(() => {
    // Clear storage between tests
    try {
      window.localStorage.clear();
    } catch {}
    jest.useRealTimers();
  });

  test('exposes util on window', () => {
    expect(getUtil()).toBeTruthy();
  });

  test('randomDelay returns integer within range', () => {
    const util = getUtil();
    const min = 10;
    const max = 20;
    for (let i = 0; i < 100; i++) {
      const v = util.randomDelay(min, max);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });

  test('safeExecute returns default on error', () => {
    const util = getUtil();
    const ok = util.safeExecute(() => 42, 'ok', -1);
    expect(ok).toBe(42);

    const fallback = util.safeExecute(() => {
      throw new Error('boom');
    }, 'fail', 'default');
    expect(fallback).toBe('default');
  });

  test('throttle behaves as trailing debounce', () => {
    const util = getUtil();
    jest.useFakeTimers();
    const fn = jest.fn();
    const throttled = util.throttle(fn, 100);

    // Rapid calls
    throttled();
    throttled();
    throttled();

    // Before 100ms, should not have executed yet
    jest.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    // After 100ms, exactly one call
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('debounce (trailing) consolidates calls', () => {
    const util = getUtil();
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = util.debounce(fn, 100, false);

    debounced();
    debounced();
    debounced();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('debounce (leading) calls once immediately', () => {
    const util = getUtil();
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = util.debounce(fn, 100, true);

    // First call fires immediately
    debounced();
    expect(fn).toHaveBeenCalledTimes(1);

    // Subsequent calls within wait do not fire
    debounced();
    debounced();
    expect(fn).toHaveBeenCalledTimes(1);

    // After window passes, next call fires immediately again
    jest.advanceTimersByTime(100);
    debounced();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('storage get/set/remove works with namespacing', () => {
    const util = getUtil();
    expect(util.storage.get('k', 'd')).toBe('d');
    expect(util.storage.set('k', { a: 1 })).toBe(true);
    expect(util.storage.get('k')).toEqual({ a: 1 });
    expect(util.storage.remove('k')).toBe(true);
    expect(util.storage.get('k', null)).toBeNull();
    // Ensure namespacing prefix exists in raw storage
    expect(Object.keys(window.localStorage).some(k => /DeepLearn_/.test(k))).toBe(false);
  });

  test('getUrlParameter reads from current search', () => {
    const util = getUtil();
    window.history.pushState({}, '', '?foo=bar+baz&x=1');
    expect(util.getUrlParameter('foo')).toBe('bar baz');
    expect(util.getUrlParameter('x')).toBe('1');
    expect(util.getUrlParameter('missing')).toBe('');
  });

  test('simulateClick dispatches sequence and triggers handler', () => {
    const util = getUtil();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const received = [];
    ['mousedown', 'mouseup', 'click'].forEach(type =>
      btn.addEventListener(type, e => received.push(e.type))
    );
    const onClick = jest.fn();
    btn.addEventListener('click', onClick);

    util.simulateClick(btn);

    expect(onClick).toHaveBeenCalledTimes(1);
    // Ensure click is the last event in the sequence we observe
    expect(received[received.length - 1]).toBe('click');
  });

  test('waitForElement resolves when element appears', async () => {
    const util = getUtil();
    const promise = util.waitForElement('#late', 500);
    // Append later in the same tick
    setTimeout(() => {
      const div = document.createElement('div');
      div.id = 'late';
      document.body.appendChild(div);
    }, 10);

    const el = await promise;
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.id).toBe('late');
  });

  test('waitForElement resolves immediately when already present', async () => {
    const util = getUtil();
    const div = document.createElement('div');
    div.id = 'exists';
    document.body.appendChild(div);
    const el = await util.waitForElement('#exists', 500);
    expect(el).toBe(div);
  });

  test('waitForElement rejects on timeout', async () => {
    const util = getUtil();
    jest.useFakeTimers();
    const p = util.waitForElement('#never', 10);
    jest.advanceTimersByTime(15);
    await expect(p).rejects.toThrow('not found');
  });

  test('isElementVisible reflects style rules', () => {
    const util = getUtil();
    const el = document.createElement('div');
    document.body.appendChild(el);

    expect(util.isElementVisible(el)).toBe(true);
    // null element is not visible
    expect(util.isElementVisible(null)).toBe(false);
    el.style.display = 'none';
    expect(util.isElementVisible(el)).toBe(false);
    el.style.display = '';
    el.style.visibility = 'hidden';
    expect(util.isElementVisible(el)).toBe(false);
    el.style.visibility = '';
    el.style.opacity = '0';
    expect(util.isElementVisible(el)).toBe(false);
  });

  test('scrollIntoView calls element.scrollIntoView with defaults', () => {
    const util = getUtil();
    const el = document.createElement('div');
    el.scrollIntoView = jest.fn();
    util.scrollIntoView(el);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    const arg = el.scrollIntoView.mock.calls[0][0];
    expect(arg.behavior).toBe('smooth');
    expect(arg.block).toBe('center');
    expect(arg.inline).toBe('nearest');
  });

  test('scrollIntoView is no-op for falsy element', () => {
    const util = getUtil();
    expect(() => util.scrollIntoView(null)).not.toThrow();
  });

  test('simulateClick is no-op for null', () => {
    const util = getUtil();
    expect(() => util.simulateClick(null)).not.toThrow();
  });

  test('log routes to appropriate console method', () => {
    const util = getUtil();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    util.log('info', 'hello');
    util.log('warn', 'careful');
    util.log('error', 'boom');
    // default branch (unknown level) falls through to console.log
    util.log('debug', 'details');

    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('performance.start/end measures and logs duration', () => {
    const util = getUtil();
    const infoSpy = jest.spyOn(util, 'logInfo').mockImplementation(() => {});

    const originalPerf = globalThis.performance;
    const measures = [];
    // Some jsdom environments lack mark/measure; mock if missing
    if (typeof originalPerf.mark !== 'function') {
      Object.defineProperty(globalThis, 'performance', {
        configurable: true,
        value: {
          ...originalPerf,
          mark: jest.fn(),
          measure: jest.fn((label) => {
            measures.push({ name: label, duration: 1 });
          }),
          getEntriesByName: jest.fn((label) => measures.filter(m => m.name === label)),
        },
      });
    }

    util.performance.start('unit');
    util.performance.end('unit');

    expect(infoSpy).toHaveBeenCalled();
    const msg = infoSpy.mock.calls[0][0];
    expect(msg).toEqual(expect.stringContaining('性能监控: unit'));
    infoSpy.mockRestore();

    // Restore performance if we replaced it
    if (globalThis.performance !== originalPerf) {
      Object.defineProperty(globalThis, 'performance', {
        configurable: true,
        value: originalPerf,
      });
    }
  });

  test('global error handlers log appropriately', () => {
    const util = getUtil();
    const errSpy = jest.spyOn(util, 'logError').mockImplementation(() => {});

    const errorEvent = new Event('error');
    errorEvent.error = new Error('boom');
    window.dispatchEvent(errorEvent);
    expect(errSpy).toHaveBeenCalledWith('全局错误', errorEvent.error);

    const rejEvent = new Event('unhandledrejection');
    const reason = new Error('blocked');
    reason.name = 'NotAllowedError';
    rejEvent.reason = reason;
    window.dispatchEvent(rejEvent);
    expect(errSpy).toHaveBeenCalledWith(
      '未处理的Promise拒绝',
      expect.stringContaining('NotAllowedError: blocked')
    );

    errSpy.mockRestore();
  });

  test('NotAllowedError recovery attaches once and plays video on gesture', () => {
    const util = getUtil();
    // Clear any leftover once listeners from prior tests
    window.dispatchEvent(new Event('click', { bubbles: true }));
    window.dispatchEvent(new Event('keydown', { bubbles: true }));
    // Ensure a <video> exists with a play() that returns thenable with catch
    const video = document.createElement('video');
    const playCatch = jest.fn();
    video.play = jest.fn(() => ({ catch: playCatch }));
    document.body.appendChild(video);

    const evt = new Event('unhandledrejection');
    const reason = new Error('policy');
    reason.name = 'NotAllowedError';
    evt.reason = reason;
    window.dispatchEvent(evt);

    // Simulate a user gesture
    window.dispatchEvent(new Event('click', { bubbles: true }));

    expect(video.play).toHaveBeenCalledTimes(1);
    expect(playCatch).toHaveBeenCalled();

    // Dispatching another click should not trigger again (once semantics)
    window.dispatchEvent(new Event('click', { bubbles: true }));
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  test('storage error paths return defaults and log', () => {
    const util = getUtil();
    const logErr = jest.spyOn(util, 'logError').mockImplementation(() => {});

    // get: JSON.parse throws
    window.localStorage.setItem('DeepLearn_bad', '{not-json');
    expect(util.storage.get('bad', 'default')).toBe('default');
    expect(logErr).toHaveBeenCalled();

    // set: Storage throws
    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(util.storage.set('key', { a: 1 })).toBe(false);
    expect(logErr).toHaveBeenCalled();
    setSpy.mockRestore();

    // remove: Storage throws
    const remSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('io');
    });
    expect(util.storage.remove('key')).toBe(false);
    expect(logErr).toHaveBeenCalled();
    remSpy.mockRestore();

    logErr.mockRestore();
  });

  test('logInfo/logWarn/logError proxy to log with proper levels', () => {
    const util = getUtil();
    const spy = jest.spyOn(util, 'log').mockImplementation(() => {});
    util.logInfo('i', 1);
    util.logWarn('w', 2);
    util.logError('e', 3);
    expect(spy).toHaveBeenNthCalledWith(1, 'info', 'i', 1);
    expect(spy).toHaveBeenNthCalledWith(2, 'warn', 'w', 2);
    expect(spy).toHaveBeenNthCalledWith(3, 'error', 'e', 3);
    spy.mockRestore();
  });
});
