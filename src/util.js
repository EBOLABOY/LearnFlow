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

  // 文本归一化与文本查找工具
  util.normalizeText = function normalizeText(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '').trim().toLowerCase();
  };

  util.getElementText = function getElementText(el) {
    try {
      return (el?.textContent || el?.innerText || el?.value || el?.getAttribute?.('aria-label') || el?.getAttribute?.('title') || '').trim();
    } catch (_) {
      return '';
    }
  };

  // 递归向上查找“可点击”祖先
  function findClickableAncestor(node) {
    let el = node && node.nodeType === 1 ? node : node?.parentElement || null;
    const isClickable = (e) => {
      if (!e) return false;
      const tag = (e.tagName || '').toLowerCase();
      const role = (e.getAttribute && e.getAttribute('role')) || '';
      if (tag === 'button' || tag === 'a' || tag === 'label' || tag === 'input') return true;
      if (role === 'button' || role === 'tab' || role === 'link') return true;
      if (e.classList && (e.classList.contains('el-button') || e.classList.contains('el-radio') || e.classList.contains('el-checkbox'))) return true;
      if (e.onclick || typeof e.onclick === 'function') return true;
      try {
        const style = window.getComputedStyle(e);
        if (style.cursor === 'pointer') return true;
      } catch {}
      return false;
    };
    let steps = 0;
    while (el && steps < 5) {
      if (isClickable(el)) return el;
      el = el.parentElement;
      steps++;
    }
    return node?.nodeType === 1 ? node : null;
  }

  // 在页面(或scope)内按文本查找候选元素
  util.findByText = function findByText(texts, options = {}) {
    const {
      scope = document,
      exact = false,
      prefer = ['button', '[role="button"]', 'input[type="button"]', 'input[type="submit"]', 'a[role="button"]', '.el-button', 'label', '.el-radio', '.el-checkbox', '[class*="button"]'],
      exclude = [],
      nth = 0,
    } = options || {};

    const targetList = Array.isArray(texts) ? texts : [texts];
    const normalizedTargets = targetList.map(t => util.normalizeText(t));
    const normalizedExclude = (Array.isArray(exclude) ? exclude : [exclude]).map(t => util.normalizeText(t)).filter(Boolean);
    const matchFn = (text) => normalizedTargets.some(t => t && (exact ? util.normalizeText(text) === t : util.normalizeText(text).includes(t)));
    const isExcluded = (text) => normalizedExclude.length > 0 && normalizedExclude.some(t => util.normalizeText(text) === t || util.normalizeText(text).includes(t));

    // 1) 优先在可点击元素集合中匹配
    let candidates = [];
    try {
      const clickableSelector = prefer.join(',');
      candidates = Array.from(scope.querySelectorAll(clickableSelector));
    } catch {}

    const visibleCandidates = candidates.filter(el => util.isElementVisible(el));
    const matchedOnClickable = visibleCandidates.filter(el => {
      const txt = util.getElementText(el);
      return matchFn(txt) && !isExcluded(txt);
    });
    if (matchedOnClickable.length > nth) return matchedOnClickable[nth];

    // 2) 回退：遍历文本节点，向上寻找可点击祖先
    try {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          try {
            const text = String(node.nodeValue || '').trim();
            if (!text) return NodeFilter.FILTER_REJECT;
            return matchFn(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          } catch (_) { return NodeFilter.FILTER_SKIP; }
        }
      });
      const collected = [];
      let n;
      while ((n = walker.nextNode())) {
        const text = String(n.nodeValue || '');
        if (isExcluded(text)) continue;
        const clickable = findClickableAncestor(n.parentElement || n);
        if (clickable && util.isElementVisible(clickable)) collected.push(clickable);
      }
      if (collected.length > nth) return collected[nth];
    } catch {}

    return null;
  };

  util.clickByText = function clickByText(texts, options = {}) {
    const el = util.findByText(texts, options);
    if (el) util.simulateClick(el);
    return el;
  };

  util.waitClickByText = function waitClickByText(texts, { timeout = 10000, pollInterval = 300, ...opts } = {}) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function tick() {
        try {
          const el = util.findByText(texts, opts);
          if (el) { util.simulateClick(el); return resolve(el); }
          if (Date.now() - start > timeout) return reject(new Error(`等待文本按钮超时: ${Array.isArray(texts) ? texts.join('|') : texts}`));
          setTimeout(tick, pollInterval);
        } catch (e) { reject(e); }
      })();
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
        :host { 
          all: initial; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
        }
        
        .notification-container { 
          position: fixed; 
          top: 20px; 
          right: 20px; 
          z-index: 2147483647; 
          pointer-events: none; 
          max-width: 420px; 
        }
        
        .notification { 
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          margin-bottom: 16px;
          pointer-events: auto;
          cursor: pointer;
          opacity: 0;
          transform: translateX(100%);
          transition: all 0.4s cubic-bezier(0.215, 0.61, 0.355, 1);
          position: relative;
          overflow: hidden;
        }
        
        .notification.show {
          opacity: 1;
          transform: translateX(0);
        }
        
        .notification.success {
          border-left: 4px solid #10b981;
        }
        
        .notification.error {
          border-left: 4px solid #ef4444;
        }
        
        .notification.warning {
          border-left: 4px solid #f59e0b;
        }
        
        .notification.info {
          border-left: 4px solid #3b82f6;
        }
        
        .notification:hover {
          transform: translateX(0) translateY(-2px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        
        .notification-content {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px 24px;
          padding-right: 48px;
        }
        
        .notification-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .notification.success .notification-icon-wrapper {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        
        .notification.error .notification-icon-wrapper {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        
        .notification.warning .notification-icon-wrapper {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }
        
        .notification.info .notification-icon-wrapper {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }
        
        .notification-icon-wrapper svg {
          width: 20px;
          height: 20px;
        }
        
        .notification-text-wrapper {
          flex: 1;
          min-width: 0;
        }
        
        .notification-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 4px 0;
          line-height: 1.4;
        }
        
        .notification-message {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
        }
        
        .notification-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          border: none;
          background: rgba(107, 114, 128, 0.1);
          color: #6b7280;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-size: 14px;
        }
        
        .notification-close:hover {
          background: rgba(107, 114, 128, 0.2);
          color: #374151;
        }
      `;
      const container = document.createElement('div');
      container.className = 'notification-container';
      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(container);
      document.documentElement.appendChild(this.shadowHost);
      util.logInfo('企业级通知系统已初始化');
    },
    show(message, type = 'success', duration = 3000) {
      this.init();
      const container = this.shadowRoot.querySelector('.notification-container');
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      
      // SVG图标定义
      const svgIcons = {
        success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>`,
        error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>`,
        warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>`,
        info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`
      };

      // 类型标题映射
      const typeTitles = {
        success: '操作成功',
        error: '操作失败', 
        warning: '注意',
        info: '提示'
      };

      // 智能解析消息内容
      let title = typeTitles[type] || '通知';
      let messageText = message;
      
      // 如果消息包含标题分隔符，进行分割
      if (message.includes('：') || message.includes(':')) {
        const parts = message.split(/[：:]/);
        if (parts.length >= 2) {
          title = parts[0].trim();
          messageText = parts.slice(1).join(':').trim();
        }
      }
      
      notification.innerHTML = `
        <div class="notification-content">
          <div class="notification-icon-wrapper">
            ${svgIcons[type] || svgIcons.info}
          </div>
          <div class="notification-text-wrapper">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${messageText}</div>
          </div>
        </div>
        <button class="notification-close" title="关闭">×</button>
      `;
      
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.remove(notification);
      });
      
      notification.addEventListener('click', () => this.remove(notification));
      container.appendChild(notification);
      
      // 使用requestAnimationFrame确保动画正确触发
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          notification.classList.add('show');
        });
      });
      
      if (duration > 0) {
        setTimeout(() => this.remove(notification), duration);
      }
      
      return notification;
    },
    remove(notification) {
      if (!notification || !notification.parentNode) return;
      
      // 移除.show类触发出场动画
      notification.classList.remove('show');
      
      // 设置出场动画的最终状态
      notification.style.transform = 'translateX(100%) scale(0.9)';
      notification.style.opacity = '0';
      notification.style.marginBottom = '0';
      notification.style.maxHeight = '0';
      notification.style.paddingTop = '0';
      notification.style.paddingBottom = '0';
      notification.style.overflow = 'hidden';
      
      // 等待动画完成后移除元素（与CSS transition时长匹配）
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 400); // 匹配CSS transition的0.4s
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

  util.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ProgressBar进度条管理器 - 使用Shadow DOM隔离样式
  util.ProgressBarManager = {
    host: null,
    shadowRoot: null,

    create(duration, title = '正在处理，请稍候...') {
      // 确保单例模式，避免重复创建
      this.destroy();

      // 创建宿主元素
      this.host = document.createElement('div');
      this.host.id = 'deeplearn-progress-host';
      this.host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;width:100%;height:100%;pointer-events:auto;';
      
      // 创建Shadow DOM
      this.shadowRoot = this.host.attachShadow({ mode: 'closed' });

      // 注入企业级样式
      const style = document.createElement('style');
      style.textContent = `
        :host { 
          all: initial; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
        }

        .progress-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .progress-overlay.visible {
          opacity: 1;
        }

        .progress-box {
          background: #ffffff;
          border-radius: 12px;
          padding: 32px 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          width: 420px;
          text-align: center;
          transform: scale(0.95);
          opacity: 0;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease;
        }

        .progress-overlay.visible .progress-box {
          transform: scale(1);
          opacity: 1;
        }

        .progress-title {
          color: #1a202c;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }

        .progress-subtitle {
          color: #718096;
          font-size: 14px;
          margin: -8px 0 24px 0;
        }

        .progress-track {
          width: 100%;
          height: 10px;
          background: #e2e8f0;
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .progress-bar {
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #4299e1 0%, #3182ce 100%);
          border-radius: 5px;
          transition: width ${duration}ms linear;
        }

        .progress-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #4a5568;
          font-size: 14px;
        }

        .progress-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;

      // 注入企业级HTML结构
      const container = document.createElement('div');
      container.className = 'progress-overlay';
      container.innerHTML = `
        <div class="progress-box">
          <div class="progress-title">${title}</div>
          <div class="progress-subtitle">正在模拟真实考试过程，请勿关闭或刷新页面</div>
          <div class="progress-track">
            <div class="progress-bar" id="progress-bar"></div>
          </div>
          <div class="progress-info">
            <svg class="progress-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.93 4.93l2.83 2.83"></path>
              <path d="M16.24 16.24l2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path>
              <path d="M4.93 19.07l2.83-2.83"></path><path d="M16.24 7.76l2.83-2.83"></path>
            </svg>
            <span>正在智能提交，预计还需 <span id="eta-seconds">${Math.ceil(duration / 1000)}</span> 秒...</span>
          </div>
        </div>
      `;

      // 添加到Shadow DOM
      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(container);

      // 添加到页面
      document.body.appendChild(this.host);

      // 设置动态倒计时
      const etaElement = this.shadowRoot.getElementById('eta-seconds');
      let secondsLeft = Math.ceil(duration / 1000);

      // 启动秒数倒计时
      const countdownInterval = setInterval(() => {
        secondsLeft--;
        if (etaElement) {
          etaElement.textContent = secondsLeft > 0 ? secondsLeft : 0;
        }
        if (secondsLeft <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // 启动优雅的动画效果 (延迟以触发CSS transition)
      setTimeout(() => {
        container.classList.add('visible'); // 触发淡入动画
        const progressBar = this.shadowRoot.getElementById('progress-bar');
        if (progressBar) {
          progressBar.style.width = '100%';
        }
      }, 50);

      util.logInfo(`企业级进度条已显示，预计${Math.ceil(duration / 1000)}秒完成`);
      
      // 将倒计时定时器ID保存在host元素上，以便在destroy时清除
      this.host._countdownInterval = countdownInterval;
    },

    destroy() {
      if (this.host) {
        // 清除倒计时定时器，防止内存泄漏
        if (this.host._countdownInterval) {
          clearInterval(this.host._countdownInterval);
        }
        if (this.host.parentNode) {
          this.host.parentNode.removeChild(this.host);
        }
        util.logInfo('企业级进度条已移除');
      }
      this.host = null;
      this.shadowRoot = null;
    }
  };
})();

