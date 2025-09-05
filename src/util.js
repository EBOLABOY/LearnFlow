(() => {
  const ns = (window.DeepLearn ||= {});
  const util = (ns.util ||= {});

  // 随机延迟函数
  util.randomDelay = function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  };

  // 模拟点击事件
  util.simulateClick = function simulateClick(element) {
    if (!element) return;
    const eventSequence = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    eventSequence.forEach(eventName => {
      const event = new MouseEvent(eventName, { 
        bubbles: true, 
        cancelable: true, 
        view: window 
      });
      element.dispatchEvent(event);
    });
  };

  // 获取URL参数
  util.getUrlParameter = function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  // 等待元素出现
  util.waitForElement = function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  };

  // 安全执行函数，带错误处理
  util.safeExecute = function safeExecute(fn, context = 'Unknown', defaultValue = null) {
    try {
      return fn();
    } catch (error) {
      console.error(`[深学助手] ${context} 执行出错:`, error);
      return defaultValue;
    }
  };

  // 格式化日志
  util.log = function log(level, message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[深学助手 ${timestamp}]`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'info':
      default:
        console.log(prefix, message, ...args);
        break;
    }
  };

  // 简化日志方法
  util.logInfo = (msg, ...args) => util.log('info', msg, ...args);
  util.logWarn = (msg, ...args) => util.log('warn', msg, ...args);
  util.logError = (msg, ...args) => util.log('error', msg, ...args);

  // 节流函数
  util.throttle = function throttle(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // 防抖函数
  util.debounce = function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  };

  // 检查元素是否可见
  util.isElementVisible = function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  };

  // 滚动元素到视图中
  util.scrollIntoView = function scrollIntoView(element, options = {}) {
    if (!element) return;
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
      ...options
    });
  };

  // 存储管理
  util.storage = {
    get: function(key, defaultValue = null) {
      try {
        const value = localStorage.getItem(`DeepLearn_${key}`);
        return value ? JSON.parse(value) : defaultValue;
      } catch (error) {
        util.logError('存储读取失败', key, error);
        return defaultValue;
      }
    },
    
    set: function(key, value) {
      try {
        localStorage.setItem(`DeepLearn_${key}`, JSON.stringify(value));
        return true;
      } catch (error) {
        util.logError('存储写入失败', key, error);
        return false;
      }
    },
    
    remove: function(key) {
      try {
        localStorage.removeItem(`DeepLearn_${key}`);
        return true;
      } catch (error) {
        util.logError('存储删除失败', key, error);
        return false;
      }
    }
  };

  // 全局错误处理
  util.setupGlobalErrorHandler = function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      util.logError('全局错误', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      util.logError('未处理的Promise拒绝', event.reason);
    });
  };

  // 性能监控
  util.performance = {
    start: function(label) {
      performance.mark(`${label}-start`);
    },
    
    end: function(label) {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      const measure = performance.getEntriesByName(label)[0];
      util.logInfo(`性能监控: ${label} 耗时 ${measure.duration.toFixed(2)}ms`);
    }
  };

  // 初始化工具模块
  util.init = function init() {
    util.setupGlobalErrorHandler();
    util.logInfo('工具模块已初始化');
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', util.init);
  } else {
    util.init();
  }

  console.log('[深学助手] 工具函数模块已加载');
})();

