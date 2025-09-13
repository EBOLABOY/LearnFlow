// SmartEdu Automation - 自动化流程控制（UTF-8 清洁版）
// 负责 DOM 操作、页面逻辑判断和流程控制
(() => {
  'use strict';

  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const smartedu = (siteNS.smartedu ||= {});
  const util = ns.util || {};

  // 统一通知代理（所有本文件的消息提示都走 util.showMessage）
  const showMessage = (...args) => {
    try { return util && typeof util.showMessage === 'function' ? util.showMessage(...args) : null; } catch (_) { return null; }
  };

  // 错误上报助手
  function report(err, extra = {}) {
    try {
      if (util && typeof util.reportError === 'function') {
        util.reportError(err, { module: 'smartedu.automation', ...extra });
      } else {
        chrome.runtime?.sendMessage && chrome.runtime.sendMessage({ action: 'reportError', name: err?.name, message: err?.message || String(err), stack: err?.stack, extra: { module: 'smartedu.automation', ...extra } }, () => {});
      }
    } catch (_) {}
  }

  // 默认配置（从 config.js 获取配置，如果没有则使用默认值）
  const smarteduConfig = siteNS.smartedu || {};
  const PLATFORM = smarteduConfig.PLATFORM_CONFIG || {};
  const DEFAULT_CONFIG = {
    courseName: PLATFORM.courseName || '默认课程',
    homeUrl: PLATFORM.homeUrl || location.origin,
    courseUrls: (typeof smarteduConfig.getCourseUrls === 'function' ? smarteduConfig.getCourseUrls() : []),
    lessons: (typeof smarteduConfig.getDefaultLessons === 'function' ? smarteduConfig.getDefaultLessons() : []),
    watchInterval: PLATFORM.watchInterval || 10000,
    autoNext: PLATFORM.autoNext !== false,
  };

  let config = { ...DEFAULT_CONFIG };
  let isRunning = false;
  let watchTimer = null;
  let tick = 0;
  let pageNumber = null;
  let pageCount = null;

  // Agent 握手状态管理
  let agentReady = false;
  let pendingAgentCommands = [];
  const AGENT_READY_TIMEOUT = 10000; // 10 秒超时

  // 注入 Agent 脚本并等待握手（若已由后台注入，则跳过避免重复注入）
  function injectAgent() {
    return new Promise((resolve, reject) => {
      try {
        if (window.DeepLearnSmartEduAgent) {
          // 已存在 Agent，全局只需标记为已就绪并刷新队列
          agentReady = true;
          try { processPendingAgentCommands(); } catch {}
          console.log('[深学助手] 检测到 Agent 已存在，跳过二次注入');
          resolve(true);
          return;
        }
      } catch {}
      try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/sites/smartedu/agent.js');
        (document.head || document.documentElement).appendChild(script);
        script.onload = () => {
          script.remove();
          // 等待握手信号
          const timeout = setTimeout(() => {
            console.warn('[深学助手] Agent 握手超时，继续执行但功能可能受限');
            agentReady = false;
            resolve(false);
          }, AGENT_READY_TIMEOUT);
          const onReady = (event) => {
            if (event.source === window && event.origin === window.location.origin && event.data && event.data.target === 'deeplearn-smartedu-controller' && event.data.command === 'AGENT_READY') {
              clearTimeout(timeout);
              window.removeEventListener('message', onReady);
              agentReady = true;
              console.log('[深学助手] Agent 握手成功！能力: ', event.data.payload && event.data.payload.capabilities);
              processPendingAgentCommands();
              resolve(true);
            }
          };
          window.addEventListener('message', onReady);
        };
        script.onerror = () => {
          const err = new Error('Agent script injection failed');
          console.error('[深学助手] Agent 脚本注入失败');
          try { report(err, { where: 'injectAgent' }); } catch {}
          reject(err);
        };
      } catch (e) {
        try { report(e, { where: 'injectAgent.try' }); } catch {}
        reject(e);
      }
    });
  }

  // 加载/合并用户配置（兼容 local/sync 与大小写差异）
  function loadConfig() {
    return new Promise((resolve) => {
      const apply = (u) => {
        if (!u) return;
        config = { ...DEFAULT_CONFIG, ...u };
        if (Array.isArray(u.lessons)) config.lessons = u.lessons;
        if (typeof u.courseUrl === 'string') config.customCourseUrl = u.courseUrl;
        if (typeof u.watchInterval === 'number') config.watchInterval = u.watchInterval;
        if (typeof u.instantComplete === 'boolean') config.instantComplete = u.instantComplete;
      };

      const trySync = () => {
        try {
          chrome.storage.sync.get(['smarteduConfig','smartEduConfig'], (data) => {
            apply(data.smarteduConfig || data.smartEduConfig);
            resolve();
          });
        } catch (_) { resolve(); }
      };

      try {
        chrome.storage.local.get(['smarteduConfig','smartEduConfig'], (data) => {
          if (data && (data.smarteduConfig || data.smartEduConfig)) {
            apply(data.smarteduConfig || data.smartEduConfig);
            resolve();
          } else {
            trySync();
          }
        });
      } catch (_) { trySync(); }
    });
  }

  // 智慧平台提示弹窗自动关闭（增强版）
  function clickIKnowButtons(scope = document) {
    try {
      // 方法1：精确匹配您提供的弹窗结构
      const modalConfirm = scope.querySelector('.fish-modal-confirm');
      if (modalConfirm) {
        // 检查是否是视频学时提示
        const content = modalConfirm.querySelector('.fish-modal-confirm-content');
        if (content && content.textContent.includes('须学习完课程的视频')) {
          const knowBtn = modalConfirm.querySelector('.fish-modal-confirm-btns .fish-btn-primary');
          if (knowBtn) {
            console.log('[深学助手] 检测到视频学时提示，自动点击"我知道了"');
            try { 
              knowBtn.click();
              // 如果普通点击无效，尝试派发事件
              if (modalConfirm.parentElement) {
                setTimeout(() => {
                  const evt = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                  });
                  knowBtn.dispatchEvent(evt);
                }, 100);
              }
            } catch (e) {
              console.warn('[深学助手] 点击失败，尝试备用方法');
              knowBtn.click();
            }
            return true;
          }
        }
      }
      
      // 方法2：通用查找所有可能的按钮
      const candidates = [];
      // 精确选择器
      candidates.push(...scope.querySelectorAll('.fish-modal-confirm-btns .fish-btn-primary'));
      // 扩展选择器
      candidates.push(...scope.querySelectorAll('.fish-modal .fish-btn-primary'));
      candidates.push(...scope.querySelectorAll('button.fish-btn.fish-btn-primary'));
      // 更宽泛的选择器
      candidates.push(...scope.querySelectorAll('.fish-modal button'));
      
      for (const btn of candidates) {
        if (!btn || btn.disabled) continue;
        const text = (btn.textContent || btn.innerText || '').trim();
        if (!text) continue;
        
        // 匹配各种可能的文本
        const keywords = ['我知道了', '知道了', '知道', '确定', '确认', '好的', 'OK'];
        if (keywords.some(keyword => text.includes(keyword))) {
          try { 
            // 检查按钮是否可见
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              if (util && util.simulateClick) {
                util.simulateClick(btn);
              } else {
                btn.click();
              }
              console.log('[深学助手] 已自动点击提示按钮：', text);
              return true;
            }
          } catch { 
            try { 
              btn.click(); 
              console.log('[深学助手] 已自动点击提示按钮（备用方法）：', text);
              return true;
            } catch {} 
          }
        }
      }
      
      // 方法3：根据弹窗内容智能查找按钮
      const modalRoots = scope.querySelectorAll('.fish-modal-root');
      for (const root of modalRoots) {
        // 检查是否包含特定文本
        const hasVideoHint = root.textContent.includes('学习完课程') || 
                             root.textContent.includes('视频') ||
                             root.textContent.includes('学时');
        if (hasVideoHint) {
          const btn = root.querySelector('button');
          if (btn) {
            try {
              btn.click();
              console.log('[深学助手] 根据内容智能关闭弹窗');
              return true;
            } catch {}
          }
        }
      }
      
      // 方法4：查找所有模态框并尝试关闭
      const allModals = scope.querySelectorAll('.fish-modal-wrap[role="dialog"]');
      for (const modal of allModals) {
        // 检查模态框是否可见
        if (modal.style.display !== 'none') {
          const btn = modal.querySelector('.fish-btn-primary, button');
          if (btn && !btn.textContent.includes('取消')) {
            try {
              btn.click();
              console.log('[深学助手] 关闭检测到的模态框');
              return true;
            } catch {}
          }
        }
      }
      
    } catch (e) {
      try { report(e, { where: 'clickIKnowButtons' }); } catch {}
    }
    return false;
  }
  
  // 设置弹窗自动关闭（增强版）
  function setupModalAutoClose() {
    try {
      // 立即尝试一次
      clickIKnowButtons(document);
      
      // 创建一个更高效的观察器
      let closeAttempts = 0;
      const maxAttempts = 3;
      
      const observer = new MutationObserver((mutations) => {
        // 快速检查是否有相关变化
        let hasModalChange = false;
        
        for (const mutation of mutations) {
          // 检查是否添加了模态框相关节点
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) { // Element node
                const element = node;
                // 检查是否是模态框或包含模态框
                if (element.classList && 
                    (element.classList.contains('fish-modal-root') ||
                     element.classList.contains('fish-modal-wrap') ||
                     element.classList.contains('fish-modal') ||
                     element.querySelector && element.querySelector('.fish-modal'))) {
                  hasModalChange = true;
                  break;
                }
              }
            }
          }
          
          // 检查属性变化（可能是显示/隐藏）
          if (mutation.type === 'attributes' && 
              mutation.target.classList &&
              mutation.target.classList.contains('fish-modal-wrap')) {
            hasModalChange = true;
          }
        }
        
        // 如果检测到模态框变化，尝试关闭
        if (hasModalChange) {
          closeAttempts = 0;
          const tryClose = () => {
            if (clickIKnowButtons(document)) {
              console.log('[深学助手] 成功关闭弹窗');
            } else if (closeAttempts < maxAttempts) {
              closeAttempts++;
              setTimeout(tryClose, 500); // 500ms后重试
            }
          };
          
          // 延迟执行，确保DOM完全渲染
          setTimeout(tryClose, 100);
        }
      });
      
      // 优化观察配置
      observer.observe(document.body || document.documentElement, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'] // 只观察相关属性
      });
      
      // 定期检查（作为兜底方案）
      setInterval(() => {
        // 查找可见的模态框
        const visibleModal = document.querySelector('.fish-modal-root');
        if (visibleModal) {
          clickIKnowButtons(document);
        }
      }, 3000); // 每3秒检查一次
      
      console.log('[深学助手] 弹窗自动关闭功能已启动（增强版）');
    } catch (e) {
      try { report(e, { where: 'setupModalAutoClose' }); } catch {}
    }
  }

  // 站点开关检查
  function checkAutoMode() {
    chrome.storage.sync.get('enabledSites', (data) => {
      const enabledSites = data.enabledSites || {};
      const domain = location.hostname;
      const enabled = enabledSites[domain] !== false; // 默认启用
      if (enabled) {
        console.log('[深学助手] 自动模式已启用，2 秒后启动...');
        setTimeout(() => { try { startMainLogic(); } catch (e) { report(e, { where: 'startMainLogic' }); } }, 2000);
      } else {
        console.log('[深学助手] 自动模式未启用或站点被禁用');
      }
    });
  }

  // Agent 消息
  function sendCommandToAgent(command, payload = null) {
    const msg = { target: 'deeplearn-smartedu-agent', command, payload, timestamp: Date.now() };
    if (agentReady) {
      window.postMessage(msg, window.location.origin);
    } else {
      pendingAgentCommands.push(msg);
    }
  }
  function processPendingAgentCommands() {
    try {
      const list = pendingAgentCommands.splice(0, pendingAgentCommands.length);
      list.forEach((m) => window.postMessage(m, window.location.origin));
    } catch (_) {}
  }
  function handleAgentMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin || !event.data) return;
    if (event.data.target !== 'deeplearn-smartedu-controller') return;
    const { command, payload } = event.data;
    console.log('[深学助手] Controller 收到 Agent 消息:', command, payload);
    switch (command) {
      case 'AGENT_READY':
        // 已在注入时处理
        console.log('[深学助手] Agent 状态确认：已就绪');
        break;
      case 'USER_ID_RESPONSE':
        console.log('[深学助手] 用户ID:', payload);
        break;
      case 'FULLS_JSON_RESPONSE':
        console.log('[深学助手] 课程数据:', payload);
        break;
      case 'FAKE_XHR_COMPLETED':
        console.log('[深学助手] 秒过操作完成:', payload);
        showMessage('✅ 秒过操作完成: ' + payload, 5000);
        break;
      case 'FAKE_XHR_ERROR':
        console.warn('[深学助手] 秒过操作失败:', payload);
        showMessage('❌ 秒过操作失败: ' + payload, 5000);
        break;
      case 'DIAGNOSIS_RESULT':
        console.log('[深学助手] 诊断结果:', payload);
        // 显示诊断结果
        const diag = payload;
        let diagMsg = `📊 诊断结果:\n`;
        diagMsg += `- 课程数据: ${diag.status.currentData}\n`;
        diagMsg += `- 授权状态: ${diag.status.headers.Authorization}\n`;
        diagMsg += `- DOM元素: ${diag.status.domElements}\n`;
        if (diag.recommendations.length > 0) {
          diagMsg += `\n💡 建议:\n`;
          diag.recommendations.forEach(r => {
            diagMsg += `- ${r}\n`;
          });
        }
        showMessage(diagMsg, 10000);
        break;
      case 'FORCE_FETCH_RESPONSE':
        console.log('[深学助手] 强制获取结果:', payload);
        showMessage('📥 ' + payload, 5000);
        break;
      default:
        console.log('[深学助手] 未处理的 Agent 消息:', command, payload);
    }
  }

  // PDF 消息
  function handlePDFMessage(event) {
    if (!event.data) return;
    const data = event.data;
    if (data.type === 'pdfPlayerInitPage') {
      pageNumber = data.data.pageNumber;
      pageCount = data.data.pageCount;
      console.log(`[深学助手] PDF文档初始: pageNumber=>${pageNumber}, pageCount=>${pageCount}`);
    }
  }

  // 主逻辑
  function startMainLogic() {
    console.log('[深学助手] 开始主逻辑...');
    const href = location.href;
    console.log('[深学助手] 当前页面:', href);
    if (config.courseUrls && config.courseUrls.includes(href)) {
      console.log('[深学助手] 检测到课程页面，开始刷课流程');
      showMessage('📚 开始自动学习课程...', 5000);
      startWatching();
    } else if (href.includes('https://smartedu.gdtextbook.com/education/')) {
      console.log('[深学助手] 广东特色教育平台 iframe 处理');
    } else if (href.includes('https://teacher.ykt.eduyun.cn/pdfjs/')) {
      console.log('[深学助手] PDF 页面处理');
      startPDFReading();
    } else {
      console.log('[深学助手] 主页面');
      if (config.instantComplete === true) {
        showInstantConfirm();
      } else {
        showMainMenu();
      }
    }
  }

  // 即刻秒过的确认弹窗（基于配置自动提示）
  function showInstantConfirm() {
    const html = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px); z-index: 9999;" id="smartedu-menu-overlay"></div>
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.65); -webkit-backdrop-filter: blur(10px) saturate(140%); backdrop-filter: blur(10px) saturate(140%); border: 1px solid rgba(255,255,255,0.45); border-radius: 14px; box-shadow: 0 18px 54px rgba(16,24,40,0.18); z-index: 10000; padding: 20px; min-width: 360px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #1E293B;">
        <h3 style="margin: 0 0 8px; text-align: center; font-weight: 800;">一键秒刷</h3>
        <p style="margin: 0 0 14px; text-align: center; color: #475569; font-size: 13px;">是否立即秒过当前主页可见课程？</p>
        <div style="display:flex; gap: 10px; justify-content: center;">
          <button id="instant-confirm" style="padding: 10px 16px; background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; border: 1px solid rgba(255,255,255,0.55); border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700;">立即秒过</button>
          <button id="instant-cancel" style="padding: 10px 16px; background: rgba(255,255,255,0.6); color: #334155; border: 1px solid rgba(255,255,255,0.6); border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700;">取消</button>
        </div>
      </div>`;
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const close = () => container.remove();
    const doInstant = () => { close(); showMessage('⚡ 启动超级秒过模式...', 2000); executeInstantComplete(); };
    container.querySelector('#instant-confirm').onclick = doInstant;
    container.querySelector('#instant-cancel').onclick = close;
    container.querySelector('#smartedu-menu-overlay').onclick = close;
  }

  function showMainMenu() {
    const menuHtml = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(6px); z-index: 9999;" id="smartedu-menu-overlay"></div>
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.6); -webkit-backdrop-filter: blur(12px) saturate(140%); backdrop-filter: blur(12px) saturate(140%); border: 1px solid rgba(255,255,255,0.45); border-radius: 16px; box-shadow: 0 20px 60px rgba(16,24,40,0.18); z-index: 10000; padding: 24px; min-width: 420px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #1E293B;">
        <h2 style="margin: 0 0 10px; text-align: center; font-weight: 800; letter-spacing: .5px;">深学助手 · 智慧教育</h2>
        <p style="text-align: center; color: #475569; margin: 0 0 18px; font-size: 13px;">选择要执行的操作</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button id="smartedu-instant-complete" style="padding: 14px 20px; background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; border: 1px solid rgba(255,255,255,0.55); border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 800; box-shadow: 0 10px 24px rgba(59, 130, 246, 0.25);">
            ⚡ 一键完成本页所有课程<br><small style="opacity: 0.9; font-weight: 600;">超级秒过模式 · 批量完成进度</small>
          </button>
          <button id="smartedu-start-courses" style="padding: 12px 20px; background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; border: 1px solid rgba(255,255,255,0.55); border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 700; box-shadow: 0 10px 24px rgba(59,130,246,0.25);">
            🚀 开始刷配置的课程<br><small style="opacity: 0.9; font-weight: 600;">${config.courseName}</small>
          </button>
          <button id="smartedu-current-page" style="padding: 12px 20px; background: rgba(255,255,255,0.6); color: #0f172a; border: 1px solid rgba(255,255,255,0.55); border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 700;">
            📖 只刷当前页的视频
          </button>
          <button id="smartedu-close-menu" style="padding: 10px 16px; background: rgba(255,255,255,0.55); color: #334155; border: 1px solid rgba(255,255,255,0.6); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 700;">
            关闭
          </button>
        </div>
      </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = menuHtml;
    document.body.appendChild(container);

    // 添加新的一键完成功能
    document.getElementById('smartedu-instant-complete').onclick = () => {
      container.remove();
      showMessage('⚡ 启动超级秒过模式...', 3000);
      executeInstantComplete();
    };

    document.getElementById('smartedu-start-courses').onclick = () => { container.remove(); showMessage('🚀 开始刷课程...', 3000); nextCourse(); };
    document.getElementById('smartedu-current-page').onclick = () => { container.remove(); showMessage('📖 开始当前页面学习...', 3000); startWatching(); };
    document.getElementById('smartedu-close-menu').onclick = () => container.remove();
    document.getElementById('smartedu-menu-overlay').onclick = () => container.remove();
  }

  // 新增：一键完成功能
  function executeInstantComplete() {
    console.log('[深学助手] 执行一键完成操作...');

    // 显示进度提示
    showMessage('⚡ 正在分析课程结构...', 2000, 'info');

    // 发送秒过命令给Agent
    setTimeout(() => {
      sendCommandToAgent('EXECUTE_FAKE_XHR');
      showMessage('🚀 批量完成指令已发送，请等待处理...', 5000, 'success');
    }, 1000);

    // 增强处理：监听Agent的反馈
    const handleInstantCompleteResult = (event) => {
      if (event.source !== window || !event.data || event.data.target !== 'deeplearn-smartedu-controller') return;

      const { command, payload } = event.data;

      if (command === 'FAKE_XHR_COMPLETED') {
        window.removeEventListener('message', handleInstantCompleteResult);
        showMessage(`✅ 超级秒过完成！${payload}`, 8000, 'success');

        // 建议用户刷新页面查看结果
        setTimeout(() => {
          if (confirm('秒过操作已完成！是否刷新页面查看学习进度？')) {
            location.reload();
          }
        }, 2000);
      } else if (command === 'FAKE_XHR_ERROR') {
        window.removeEventListener('message', handleInstantCompleteResult);
        showMessage(`❌ 秒过失败：${payload}`, 8000, 'error');

        // 提供诊断建议
        setTimeout(() => {
          showMessage('💡 建议：按 D 键进行诊断，或刷新页面重试', 5000, 'info');
        }, 3000);
      }
    };

    // 临时监听结果
    window.addEventListener('message', handleInstantCompleteResult);

    // 10秒后移除监听器（防止内存泄漏）
    setTimeout(() => {
      window.removeEventListener('message', handleInstantCompleteResult);
    }, 10000);
  }

  function nextCourse() {
    const href = location.href;
    const index = (config.courseUrls || []).indexOf(href);
    if (index > -1) {
      if (index + 1 < config.courseUrls.length) {
        console.log(`[深学助手] 跳转到下一个课程 (${index + 1}/${config.courseUrls.length})`);
        location.href = config.courseUrls[index + 1];
      } else {
        console.log('[深学助手] 所有课程已完成，返回主页');
        location.href = config.homeUrl;
      }
    } else {
      console.log('[深学助手] 开始第一个课程');
      if (config.courseUrls && config.courseUrls[0]) location.href = config.courseUrls[0];
    }
  }

  function startWatching() {
    if (isRunning) { console.log('[深学助手] 监控已在运行'); return; }
    isRunning = true;
    console.log('[深学助手] 开始监控循环..');
    
    // 立即执行一次弹窗检查
    clickIKnowButtons(document);
    
    const loop = () => {
      try {
        console.log(`[深学助手] tick[${String(++tick).padStart(9, '0')}]`);
        
        // 优先检查并关闭弹窗（放在最前面）
        clickIKnowButtons(document);
        
        // 执行其他任务
        clickNext();
        playVideo();
        readPDF();
        autoAnswer();
        
      } catch (e) { report(e, { where: 'watch.loop' }); }
    };
    
    // 首次执行延迟1秒
    setTimeout(loop, 1000);
    
    // 设置定时器
    watchTimer = setInterval(loop, config.watchInterval);
    
    // 额外的弹窗检测定时器（更频繁）
    const modalCheckTimer = setInterval(() => {
      // 专门用于检测弹窗的快速循环
      const modal = document.querySelector('.fish-modal-root, .fish-modal-confirm');
      if (modal) {
        clickIKnowButtons(document);
      }
    }, 1000); // 每秒检查一次弹窗
    
    // 保存定时器引用以便停止
    watchTimer._modalCheckTimer = modalCheckTimer;
  }
  
  function stopWatching() {
    isRunning = false;
    if (watchTimer) { 
      // 停止主循环
      clearInterval(watchTimer);
      // 停止弹窗检测循环
      if (watchTimer._modalCheckTimer) {
        clearInterval(watchTimer._modalCheckTimer);
      }
      watchTimer = null; 
    }
    console.log('[深学助手] 监控循环已停止');
  }

  function clickNext(autoNext = true) {
    // 增强版：多策略进度判断
    if (config.lessons) {
      const href = location.href;
      const index = (config.courseUrls || []).indexOf(href);
      const lesson = config.lessons[index];
      
      if (lesson !== undefined && lesson !== -1) {
        // 策略1：展开所有折叠项
        const collapseHeaders = [
          ...document.querySelectorAll('.fish-collapse-header'),
          ...document.querySelectorAll('.collapse-header'),
          ...document.querySelectorAll('[class*="collapse"][class*="header"]'),
          ...document.querySelectorAll('[data-collapsed="true"]')
        ];
        collapseHeaders.forEach(el => {
          try { el.click(); } catch {}
        });
        
        // 策略2：多套完成状态选择器
        const completedSelectors = [
          '.iconfont.icon_checkbox_fill',
          '.icon-checkbox-fill',
          '.completed',
          '.finish',
          '.done',
          '[class*="complete"]',
          '[class*="finish"]',
          '[data-completed="true"]',
          '[data-status="completed"]',
          '.study-status-finished'
        ];
        
        let finishedCount = 0;
        for (const selector of completedSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            finishedCount = Math.max(finishedCount, elements.length);
            break; // 使用第一个有效的选择器结果
          }
        }
        
        console.log(`[深学助手] 当前页面已学完【${finishedCount}】个视频，学时要求为【${lesson}】个视频，是否达标：${finishedCount >= lesson}`);
        
        if (finishedCount >= lesson) {
          console.log('[深学助手] 当前课程已达到学时要求，跳转下一个课程');
          stopWatching();
          nextCourse();
          return;
        }
      }
    }
    
    // 增强版：多策略查找下一个视频
    let targetIcon = null;
    
    // 策略1：查找进行中和未开始的课程图标
    function findIconBySelectors() {
      const iconSelectors = [
        // 原始选择器
        '.iconfont.icon_processing_fill',
        '.iconfont.icon_checkbox_linear',
        // 扩展选择器
        '.icon-processing',
        '.icon-unfinished',
        '.not-complete',
        '.pending',
        '.in-progress',
        '[class*="processing"]',
        '[class*="unfinish"]',
        '[data-completed="false"]',
        '[data-status="pending"]',
        '[data-status="processing"]',
        // 通用视频项选择器
        '.video-item:not(.completed)',
        '.lesson-item:not(.finished)',
        '.study-item:not(.done)'
      ];
      
      for (const selector of iconSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          targetIcon = element;
          console.log(`[深学助手] 通过选择器 "${selector}" 找到下一个视频`);
          return true;
        }
      }
      return false;
    }
    
    // 策略2：通过文本内容查找
    function findIconByText() {
      const allItems = document.querySelectorAll('[class*="item"], [class*="lesson"], [class*="video"]');
      for (const item of allItems) {
        const text = item.textContent || '';
        if ((text.includes('未完成') || text.includes('学习中') || text.includes('未学习')) &&
            !text.includes('已完成')) {
          const clickable = item.querySelector('a, button, [onclick], [role="button"]') || item;
          if (clickable) {
            targetIcon = clickable;
            console.log('[深学助手] 通过文本内容找到未完成视频');
            return true;
          }
        }
      }
      return false;
    }
    
    // 策略3：通过进度属性查找
    function findIconByProgress() {
      const progressItems = document.querySelectorAll('[data-progress], [data-percentage]');
      for (const item of progressItems) {
        const progress = parseInt(item.getAttribute('data-progress') || item.getAttribute('data-percentage') || '0');
        if (progress < 100) {
          const clickable = item.querySelector('a, button') || item;
          targetIcon = clickable;
          console.log(`[深学助手] 通过进度属性找到未完成视频 (进度: ${progress}%)`);
          return true;
        }
      }
      return false;
    }
    
    // 执行查找策略
    if (!findIconBySelectors()) {
      // 如果第一种策略失败，尝试展开折叠项后再查找
      const headers = document.querySelectorAll('.fish-collapse-header, [class*="collapse"]');
      for (const header of headers) {
        try {
          header.click();
          if (findIconBySelectors()) break;
        } catch {}
      }
      
      // 尝试其他策略
      if (!targetIcon) {
        findIconByText() || findIconByProgress();
      }
    }
    
    // 点击找到的元素
    if (targetIcon) {
      console.log('[深学助手] 找到下一个视频，点击播放');
      try {
        // 优先使用模拟点击
        if (util && util.simulateClick) {
          util.simulateClick(targetIcon);
        } else {
          targetIcon.click();
        }
        
        // 如果元素不可点击，尝试查找父元素或链接
        setTimeout(() => {
          if (!document.querySelector('video')) {
            const parent = targetIcon.closest('a, button, [onclick]');
            if (parent) {
              parent.click();
              console.log('[深学助手] 点击父元素');
            }
          }
        }, 1000);
      } catch (e) {
        console.warn('[深学助手] 点击失败，尝试备用方法:', e);
        targetIcon.click();
      }
    } else if (autoNext && config.autoNext) {
      console.log('[深学助手] 当前页面所有视频已播放完，跳转下一个课程');
      stopWatching();
      nextCourse();
    } else {
      console.log('[深学助手] 当前页面所有视频已播放完');
      showMessage('✅ 当前页面所有视频已播放完！', 5000);
      
      // 尝试刷新页面重新检测
      setTimeout(() => {
        console.log('[深学助手] 尝试刷新页面重新检测...');
        location.reload();
      }, 10000);
    }
  }

  // 增强版：支持iframe和多重视频定位
  function findAllVideos() {
    const videos = [];
    
    // 策略1：直接查找主文档中的视频
    videos.push(...document.querySelectorAll('video'));
    
    // 策略2：查找iframe中的视频
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          // 检查是否同源
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeVideos = iframeDoc.querySelectorAll('video');
            videos.push(...iframeVideos);
            console.log(`[深学助手] 在iframe中找到 ${iframeVideos.length} 个视频`);
          }
        } catch (e) {
          // 跨域iframe，尝试postMessage通信
          console.log('[深学助手] 检测到跨域iframe，尝试其他方法');
        }
      }
    } catch (e) {
      console.warn('[深学助手] iframe视频查找失败:', e);
    }
    
    // 策略3：查找嵌入式播放器
    const playerContainers = document.querySelectorAll(
      '.video-player, .player-container, [class*="player"], #player, #video-player'
    );
    for (const container of playerContainers) {
      const video = container.querySelector('video');
      if (video && !videos.includes(video)) {
        videos.push(video);
      }
    }
    
    return videos;
  }
  
  // 增强版视频播放（支持iframe和自动播放阻止处理）
  function playVideo(videoElement = null, retryCount = 0) {
    const maxRetries = 3;
    
    // 查找视频元素
    if (!videoElement) {
      const videos = findAllVideos();
      videoElement = videos[0]; // 使用找到的第一个视频
      
      if (!videoElement && retryCount < maxRetries) {
        console.log(`[深学助手] 未找到视频，${2}秒后重试 (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => playVideo(null, retryCount + 1), 2000);
        return;
      }
    }
    
    if (videoElement) {
      // 准备播放
      videoElement.muted = true; // 静音以提高自动播放成功率
      videoElement.volume = 0.3; // 设置默认音量
      
      // 移除可能阻止播放的属性
      videoElement.removeAttribute('disablePictureInPicture');
      
      // 尝试播放
      const attemptPlay = async () => {
        try {
          // 方法1：标准play()方法
          const playPromise = videoElement.play();
          
          if (playPromise && typeof playPromise.then === 'function') {
            await playPromise;
            console.log('[深学助手] ✅ 视频播放成功');
            
            // 播放成功后的处理
            handleVideoPlaySuccess(videoElement);
          }
        } catch (err) {
          console.warn('[深学助手] 自动播放被阻止:', err.message);
          
          // 处理播放失败
          handlePlaybackError(videoElement, err, retryCount);
        }
      };
      
      // 执行播放尝试
      attemptPlay();
      
      // 设置视频事件监听
      setupVideoEventListeners(videoElement);
      
    } else if (retryCount >= maxRetries) {
      console.error('[深学助手] 多次尝试后仍未找到视频元素');
      showMessage('⚠️ 未找到视频，请手动点击播放或刷新页面', 5000);
      
      // 尝试点击页面上的播放按钮
      tryClickPlayButton();
    }
    
    // 处理视频播放时的弹窗（保留原有逻辑）
    setTimeout(() => {
      const videoModal = document.querySelector('.fish-modal-confirm');
      if (videoModal) {
        const content = videoModal.querySelector('.fish-modal-confirm-content');
        if (content && (content.textContent.includes('须学习完课程') || 
                       content.textContent.includes('视频') || 
                       content.textContent.includes('学时'))) {
          const btn = videoModal.querySelector('.fish-btn-primary');
          if (btn) {
            btn.click();
            console.log('[深学助手] 关闭视频学时提示弹窗');
          }
        }
      }
      
      const confirmBtn = document.querySelector('.fish-modal-confirm-btns .fish-btn-primary');
      if (confirmBtn && confirmBtn.innerText.includes('知道')) {
        confirmBtn.click();
        console.log('[深学助手] 关闭视频提示（备用方法）');
      }
    }, 500);
    
    setTimeout(() => {
      clickIKnowButtons(document);
    }, 1500);
  }
  
  // 处理播放成功
  function handleVideoPlaySuccess(video) {
    // 监控视频进度
    let lastTime = 0;
    const progressChecker = setInterval(() => {
      if (video.ended) {
        clearInterval(progressChecker);
        console.log('[深学助手] 视频播放完成');
        // 自动进入下一个视频
        setTimeout(() => clickNext(), 2000);
      } else if (video.paused && video.currentTime > 0) {
        // 视频被暂停，尝试恢复
        console.log('[深学助手] 视频被暂停，尝试恢复播放');
        video.play().catch(() => {});
      } else if (video.currentTime === lastTime && !video.paused) {
        // 视频卡住了
        console.log('[深学助手] 视频可能卡住，尝试跳过');
        video.currentTime += 1;
      }
      lastTime = video.currentTime;
    }, 5000);
  }
  
  // 处理播放错误
  function handlePlaybackError(video, error, retryCount) {
    const maxRetries = 3;
    
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      // 自动播放被浏览器策略阻止
      console.log('[深学助手] 自动播放被浏览器阻止，尝试其他方法...');
      
      // 方法1：创建用户交互提示
      if (retryCount === 0) {
        showMessage('⚠️ 需要您的操作：请点击页面任意位置以启动自动播放', 8000);
        
        // 添加全屏点击监听
        const clickHandler = async (e) => {
          document.removeEventListener('click', clickHandler);
          console.log('[深学助手] 检测到用户交互，重新尝试播放');
          
          try {
            await video.play();
            console.log('[深学助手] 用户交互后播放成功');
            handleVideoPlaySuccess(video);
          } catch (err) {
            console.error('[深学助手] 用户交互后仍无法播放:', err);
            tryAlternativePlayMethods(video);
          }
        };
        
        document.addEventListener('click', clickHandler);
        
        // 10秒后自动移除监听
        setTimeout(() => {
          document.removeEventListener('click', clickHandler);
        }, 10000);
      }
      
      // 方法2：尝试点击页面上的播放按钮
      if (retryCount === 1) {
        tryClickPlayButton();
      }
      
      // 方法3：尝试其他播放方法
      if (retryCount === 2) {
        tryAlternativePlayMethods(video);
      }
      
      // 递归重试
      if (retryCount < maxRetries) {
        setTimeout(() => {
          playVideo(video, retryCount + 1);
        }, 3000);
      }
    } else {
      // 其他错误
      console.error('[深学助手] 视频播放错误:', error);
      
      // 尝试修复视频源
      if (video.src || video.currentSrc) {
        const src = video.src || video.currentSrc;
        video.load(); // 重新加载
        setTimeout(() => {
          video.play().catch(() => {});
        }, 1000);
      }
    }
  }
  
  // 尝试点击播放按钮
  function tryClickPlayButton() {
    const playButtonSelectors = [
      '.play-btn',
      '.play-button',
      '[class*="play"]',
      '[aria-label*="播放"]',
      '[aria-label*="play"]',
      'button[title*="播放"]',
      'button[title*="play"]',
      '.vjs-play-control',
      '.video-play-btn'
    ];
    
    for (const selector of playButtonSelectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        btn.click();
        console.log(`[深学助手] 点击播放按钮: ${selector}`);
        return true;
      }
    }
    
    // 在iframe中查找
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc) {
          for (const selector of playButtonSelectors) {
            const btn = iframeDoc.querySelector(selector);
            if (btn) {
              btn.click();
              console.log(`[深学助手] 在iframe中点击播放按钮: ${selector}`);
              return true;
            }
          }
        }
      } catch {}
    }
    
    return false;
  }
  
  // 尝试其他播放方法
  function tryAlternativePlayMethods(video) {
    console.log('[深学助手] 尝试替代播放方法...');
    
    // 方法1：通过设置currentTime触发播放
    try {
      video.currentTime = 0.1;
      video.play().catch(() => {});
    } catch {}
    
    // 方法2：创建新的播放按钮
    try {
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶ 点击开始自动学习';
      playBtn.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        padding: 20px 40px;
        font-size: 18px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      `;
      
      playBtn.onclick = async () => {
        playBtn.remove();
        try {
          await video.play();
          console.log('[深学助手] 通过用户点击按钮播放成功');
          handleVideoPlaySuccess(video);
        } catch (err) {
          console.error('[深学助手] 播放仍然失败:', err);
        }
      };
      
      document.body.appendChild(playBtn);
      
      // 10秒后自动移除
      setTimeout(() => {
        if (playBtn.parentNode) {
          playBtn.remove();
        }
      }, 10000);
    } catch {}
  }
  
  // 设置视频事件监听
  function setupVideoEventListeners(video) {
    // 监听播放事件
    video.addEventListener('play', () => {
      console.log('[深学助手] 视频开始播放');
    }, { once: true });
    
    // 监听暂停事件
    video.addEventListener('pause', () => {
      if (!video.ended && video.currentTime > 0) {
        console.log('[深学助手] 视频被暂停，3秒后尝试恢复');
        setTimeout(() => {
          if (video.paused && !video.ended) {
            video.play().catch(() => {});
          }
        }, 3000);
      }
    });
    
    // 监听结束事件
    video.addEventListener('ended', () => {
      console.log('[深学助手] 视频播放结束');
      setTimeout(() => {
        clickNext();
      }, 2000);
    }, { once: true });
    
    // 监听错误事件
    video.addEventListener('error', (e) => {
      console.error('[深学助手] 视频加载错误:', e);
      // 尝试重新加载
      setTimeout(() => {
        video.load();
        video.play().catch(() => {});
      }, 2000);
    });
  }

  function readPDF() {
    if (!pageCount) return;
    console.log(`[深学助手] PDF文档阅读: pageNumber=>${pageNumber}, pageCount=>${pageCount}`);
    const nextBtn = document.getElementById('next');
    if (nextBtn) nextBtn.click();
    if (pageCount) {
      console.log(`[深学助手] PDF文档跳到最后一页: ${pageCount}`);
      window.postMessage({ type: 'pdfPlayerPageChangeing', data: { pageNumber: pageCount, pageCount } }, window.location.origin);
      setTimeout(() => {
        console.log('[深学助手] PDF文档跳到第一页..');
        window.postMessage({ type: 'pdfPlayerPageChangeing', data: { pageNumber: 1, pageCount } }, window.location.origin);
      }, 1000);
      pageCount = null; // 重置
    }
  }

  function startPDFReading() { console.log('[深学助手] 开启 PDF 阅读模式'); setInterval(readPDF, config.watchInterval); }

  function autoAnswer() {
    let attempts = 0;
    const maxAttempts = 3;
    const timer = setInterval(() => {
      console.log('[深学助手] 自动答题检测..');
      const firstOption = document.getElementsByClassName('nqti-check')[0];
      if (firstOption) {
        firstOption.click();
        console.log('[深学助手] 已选择答案');
        for (let i = 0; i < 2; i++) {
          const btn = document.querySelector('div.index-module_footer_3r1Yy > button');
          if (btn) { btn.click(); console.log('[深学助手] 已提交答案'); }
        }
      }
      attempts++;
      if (attempts >= maxAttempts) clearInterval(timer);
    }, 1000);
  }

  // 键盘快捷键
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyG') { 
        showMessage('🚀 执行秒过操作...', 3000); 
        sendCommandToAgent('EXECUTE_FAKE_XHR'); 
      }
      else if (event.code === 'KeyD') { 
        showMessage('🔍 诊断课程数据获取状态...', 3000); 
        sendCommandToAgent('DIAGNOSE_COURSE_DATA'); 
      }
      else if (event.code === 'KeyF') { 
        showMessage('💪 强制获取课程结构...', 3000); 
        sendCommandToAgent('FORCE_FETCH_COURSE'); 
      }
      else if (event.code === 'KeyT') { 
        showMessage('🔧 测试功能', 2000); 
        console.log('[深学助手] 测试功能触发'); 
      }
    });
    
    console.log('[深学助手] 快捷键已启用: G=秒过, D=诊断, F=强制获取, T=测试');
  }

  // 暴露接口
  smartedu.startWatching = startWatching;
  smartedu.stopWatching = stopWatching;
  smartedu.nextCourse = nextCourse;
  smartedu.executeInstantComplete = executeInstantComplete; // 新增：暴露一键完成功能
  smartedu.isRunning = () => isRunning;
  smartedu.updateConfig = (newConfig) => { config = { ...config, ...newConfig }; chrome.storage.sync.set({ smartEduConfig: config }); };
  smartedu.triggerFakeXHR = () => sendCommandToAgent('EXECUTE_FAKE_XHR');
  smartedu.showMessage = util && util.showMessage;
  smartedu.clearNotifications = () => (util.NotificationManager && util.NotificationManager.clear());
  smartedu.destroyNotifications = () => (util.NotificationManager && util.NotificationManager.destroy());
  smartedu.isAgentReady = () => agentReady;
  smartedu.getPendingCommandCount = () => pendingAgentCommands.length;

  // 初始化自动化模块
  smartedu.initAutomation = async function initAutomation() {
    console.log('[深学助手] SmartEdu 自动化模块初始化中..');
    try {
      const agentOK = await injectAgent();
      if (!agentOK) console.warn('[深学助手] Agent 握手失败，某些功能可能不可用');
      await loadConfig();
      console.log('[深学助手] 配置加载完成:', config);
      checkAutoMode();
      window.addEventListener('message', (e) => { try { handleAgentMessage(e); } catch (err) { try { report(err, { where: 'agentMessage' }); } catch {} } });
      window.addEventListener('message', (e) => { try { handlePDFMessage(e); } catch (err) { try { report(err, { where: 'pdfMessage' }); } catch {} } });
      setupKeyboardShortcuts();
      setupModalAutoClose();
    } catch (e) {
      console.error('[深学助手] 自动化模块初始化失败:', e);
      try { report(e, { where: 'initAutomation' }); } catch {}
      showMessage('模块初始化失败', 5000);
    }
  };

  // 响应弹窗查询当前运行状态
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'getStatus') {
        sendResponse({ active: !!isRunning, status: isRunning ? 'running' : 'idle' });
      }
    });
  } catch (_) {}

})();
