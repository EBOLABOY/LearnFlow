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
      try { util.reportError && util.reportError(event.error, { where: 'window.error' }); } catch {}
    });

    window.addEventListener('unhandledrejection', (event) => {
      try {
        const r = event && event.reason;
        let detail = r;
        if (r && typeof r === 'object') {
          detail = `${r.name || 'Error'}: ${r.message || r.toString()}`;
        }
        util.logError('未处理的Promise拒绝', detail);
        try { util.reportError && util.reportError(r || new Error(String(detail)), { where: 'unhandledrejection' }); } catch {}

        // 针对常见的媒体自动播放被阻止（NotAllowedError）做温和恢复
        if (r && (r.name === 'NotAllowedError' || /NotAllowedError/i.test(r.toString()))) {
          // 一次性监听任意用户手势后尝试恢复播放
          const once = () => {
            try {
              const v = document.querySelector('video');
              if (v) {
                const p = v.play();
                if (p && p.catch) p.catch(() => {});
              }
            } catch {}
            window.removeEventListener('click', once, true);
            window.removeEventListener('keydown', once, true);
          };
          window.addEventListener('click', once, true);
          window.addEventListener('keydown', once, true);
        }
      } catch (e) {
        console.error('[深学助手] 处理unhandledrejection时出错:', e);
      }
    });
  };

  // 将错误转发到后台（Sentry）
  util.reportError = function reportError(error, extra = {}) {
    try {
      const payload = {
        action: 'reportError',
        name: (error && error.name) || 'Error',
        message: (error && error.message) || String(error),
        stack: error && error.stack,
        extra,
      };
      chrome?.runtime?.sendMessage && chrome.runtime.sendMessage(payload, () => {
        // 忽略回调错误
      });
    } catch (e) {
      // 静默失败，不影响页面功能
    }
  };

  // 发送面包屑到后台
  util.breadcrumb = function breadcrumb(category, message, level = 'info', data = {}) {
    try {
      chrome?.runtime?.sendMessage && chrome.runtime.sendMessage({
        action: 'addBreadcrumb',
        breadcrumb: { category, message, level, data }
      }, () => {});
    } catch (e) {}
  };

  // 设置 Tag（后台统一处理）
  util.setTag = function setTag(key, value) {
    try {
      chrome?.runtime?.sendMessage && chrome.runtime.sendMessage({ action: 'setTag', key, value }, () => {});
    } catch (e) {}
  };

  // 设置 Context（后台统一处理）
  util.setContext = function setContext(key, contextObj) {
    try {
      chrome?.runtime?.sendMessage && chrome.runtime.sendMessage({ action: 'setContext', key, context: contextObj }, () => {});
    } catch (e) {}
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
  // 简洁通知系统（Shadow DOM）- 公共工具
  util.NotificationManager = {
    shadowHost: null,
    shadowRoot: null,
    init() {
      if (this.shadowHost) return;
      this.shadowHost = document.createElement('div');
      this.shadowHost.id = 'deeplearn-notifications-host';
      this.shadowHost.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;width:0;height:0;';
      this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = `
        :host { all: initial; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
        .notification-container { position: fixed; top: 20px; right: 20px; z-index: 2147483647; pointer-events: none; max-width: 400px; }
        .notification { background:#4CAF50;color:#fff;padding:16px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.24),0 4px 8px rgba(0,0,0,0.12);margin-bottom:12px;font-size:14px;line-height:1.4;pointer-events:auto;cursor:pointer;transform:translateX(100%);transition:all .3s cubic-bezier(.175,.885,.32,1.275);opacity:0;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1)}
        .notification.show{transform:translateX(0);opacity:1}
        .notification.error{background:#f44336;border-color:rgba(255,255,255,.15)}
        .notification.warning{background:#FF9800;color:#333}
        .notification.info{background:#2196F3}
        .notification:hover{transform:translateX(0) scale(1.02);box-shadow:0 12px 40px rgba(0,0,0,0.3)}
        .notification-content{display:flex;align-items:flex-start;gap:12px}
        .notification-icon{flex-shrink:0;font-size:18px;margin-top:1px}
        .notification-text{flex:1;font-weight:500}
        .notification-close{position:absolute;top:8px;right:8px;width:20px;height:20px;border:none;background:rgba(255,255,255,.2);color:inherit;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;opacity:.7;transition:opacity .2s}
        .notification-close:hover{opacity:1;background:rgba(255,255,255,.3)}
      `;
      const container = document.createElement('div');
      container.className = 'notification-container';
      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(container);
      document.documentElement.appendChild(this.shadowHost);
      util.logInfo('公共 Shadow DOM 通知系统已初始化');
    },
    show(message, type = 'success', duration = 3000) {
      this.init();
      const container = this.shadowRoot.querySelector('.notification-container');
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      notification.innerHTML = `
        <div class="notification-content">
          <div class="notification-icon">${icons[type] || icons.info}</div>
          <div class="notification-text">${message}</div>
        </div>
        <button class="notification-close" title="关闭">×</button>
      `;
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => this.remove(notification));
      notification.addEventListener('click', (e) => { if (e.target !== closeBtn) this.remove(notification); });
      container.appendChild(notification);
      requestAnimationFrame(() => notification.classList.add('show'));
      if (duration > 0) setTimeout(() => this.remove(notification), duration);
      return notification;
    },
    remove(notification) {
      if (!notification || !notification.parentNode) return;
      notification.style.transform = 'translateX(100%) scale(0.8)';
      notification.style.opacity = '0';
      notification.style.marginBottom = '0';
      notification.style.height = '0';
      notification.style.paddingTop = '0';
      notification.style.paddingBottom = '0';
      setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 300);
    },
    clear() {
      if (!this.shadowRoot) return;
      const container = this.shadowRoot.querySelector('.notification-container');
      if (!container) return;
      container.querySelectorAll('.notification').forEach((n) => this.remove(n));
    },
    destroy() {
      if (this.shadowHost && this.shadowHost.parentNode) this.shadowHost.parentNode.removeChild(this.shadowHost);
      this.shadowHost = null;
      this.shadowRoot = null;
    }
  };

  util.showMessage = function showMessage(message, duration = 3000, type = 'success') {
    if (!type || type === 'success') {
      try {
        if (message.includes('❌') || message.includes('失败') || message.includes('错误')) type = 'error';
        else if (message.includes('⚠️') || message.includes('警告')) type = 'warning';
        else if (message.includes('ℹ️') || message.includes('提示')) type = 'info';
      } catch {}
    }
    return util.NotificationManager.show(message, type, duration);
  };

})();

