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

  // 注入 Agent 脚本并等待握手
  function injectAgent() {
    return new Promise((resolve, reject) => {
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

  // 加载/合并用户配置
  function loadConfig() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get('smartEduConfig', (data) => {
          if (data && data.smartEduConfig) {
            const u = data.smartEduConfig;
            config = { ...DEFAULT_CONFIG, ...u };
            if (Array.isArray(u.lessons)) config.lessons = u.lessons;
            if (typeof u.courseUrl === 'string') config.customCourseUrl = u.courseUrl;
            if (typeof u.watchInterval === 'number') config.watchInterval = u.watchInterval;
          }
          resolve();
        });
      } catch (_) { resolve(); }
    });
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
        showMessage('✅ 秒过操作完成', 3000);
        break;
      case 'FAKE_XHR_ERROR':
        console.warn('[深学助手] 秒过操作失败:', payload);
        showMessage('❌ 秒过操作失败: ' + payload, 5000);
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
      console.log('[深学助手] 主页面，显示选择菜单');
      showMainMenu();
    }
  }

  function showMainMenu() {
    const menuHtml = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 10000; padding: 24px; min-width: 400px; font-family: system-ui;">
        <h2 style="margin: 0 0 20px; text-align: center; color: #333;">深学助手 - 智慧教育平台</h2>
        <p style="text-align: center; color: #666; margin-bottom: 24px;">选择您要执行的操作：</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button id="smartedu-start-courses" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            🚀 开始刷配置的课程<br><small style="opacity: 0.8;">${config.courseName}</small>
          </button>
          <button id="smartedu-current-page" style="padding: 12px 24px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            📖 只刷当前页的视频
          </button>
          <button id="smartedu-close-menu" style="padding: 12px 24px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            ❌ 关闭
          </button>
        </div>
      </div>
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" id="smartedu-menu-overlay"></div>
    `;
    const container = document.createElement('div');
    container.innerHTML = menuHtml;
    document.body.appendChild(container);
    document.getElementById('smartedu-start-courses').onclick = () => { container.remove(); showMessage('🚀 开始刷课程...', 3000); nextCourse(); };
    document.getElementById('smartedu-current-page').onclick = () => { container.remove(); showMessage('📖 开始当前页面学习...', 3000); startWatching(); };
    document.getElementById('smartedu-close-menu').onclick = () => container.remove();
    document.getElementById('smartedu-menu-overlay').onclick = () => container.remove();
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
    const loop = () => {
      try {
        console.log(`[深学助手] tick[${String(++tick).padStart(9, '0')}]`);
        clickNext();
        playVideo();
        readPDF();
        autoAnswer();
      } catch (e) { report(e, { where: 'watch.loop' }); }
    };
    setTimeout(loop, 1000);
    watchTimer = setInterval(loop, config.watchInterval);
  }
  function stopWatching() {
    isRunning = false;
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
    console.log('[深学助手] 监控循环已停止');
  }

  function clickNext(autoNext = true) {
    // 学时判断
    if (config.lessons) {
      const href = location.href;
      const index = (config.courseUrls || []).indexOf(href);
      const lesson = config.lessons[index];
      if (lesson !== undefined && lesson !== -1) {
        // 展开所有折叠项
        Array.from(document.getElementsByClassName('fish-collapse-header')).forEach(el => el.click());
        const finished = document.getElementsByClassName('iconfont icon_checkbox_fill');
        console.log(`[深学助手] 当前页面已学完【${finished.length}】个视频，学时要求为【${lesson}】个视频，是否达标：${finished.length >= lesson}`);
        if (finished.length >= lesson) {
          console.log('[深学助手] 当前课程已达到学时要求，跳转下一个课程');
          stopWatching();
          nextCourse();
          return;
        }
      }
    }
    let targetIcon = null;
    function findIcon() {
      targetIcon = document.getElementsByClassName('iconfont icon_processing_fill')[0] || document.getElementsByClassName('iconfont icon_checkbox_linear')[0];
    }
    findIcon();
    if (!targetIcon) {
      Array.from(document.getElementsByClassName('fish-collapse-header')).some(h => { h.click(); findIcon(); return !!targetIcon; });
    }
    if (targetIcon) {
      console.log('[深学助手] 找到下一个视频，点击播放');
      targetIcon.click();
    } else if (autoNext && config.autoNext) {
      console.log('[深学助手] 当前页面所有视频已播放完，跳转下一个课程');
      stopWatching();
      nextCourse();
    } else {
      console.log('[深学助手] 当前页面所有视频已播放完');
      showMessage('✅ 当前页面所有视频已播放完！', 5000);
    }
  }

  function playVideo(videoElement = null) {
    if (!videoElement) videoElement = document.getElementsByTagName('video')[0];
    if (videoElement) {
      videoElement.muted = true;
      try {
        const p = videoElement.play();
        if (p && typeof p.then === 'function') {
          p.catch(err => console.warn('[深学助手] 浏览器阻止自动播放(需用户交互):', (err && (err.name + ': ' + err.message)) || err));
        }
      } catch (err) {
        console.warn('[深学助手] 调用 video.play() 出错:', (err && (err.name + ': ' + err.message)) || err);
      }
      console.log('[深学助手] 视频开始播放');
    }
    const confirmBtn = document.getElementsByClassName('fish-btn fish-btn-primary')[0];
    if (confirmBtn && confirmBtn.innerText.includes('知道')) {
      confirmBtn.click();
      console.log('[深学助手] 关闭视频提示');
    }
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
      if (event.code === 'KeyG') { showMessage('🚀 执行秒过操作...', 3000); sendCommandToAgent('EXECUTE_FAKE_XHR'); }
      else if (event.code === 'KeyT') { showMessage('🔧 测试功能', 2000); console.log('[深学助手] 测试功能触发'); }
    });
  }

  // 暴露接口
  smartedu.startWatching = startWatching;
  smartedu.stopWatching = stopWatching;
  smartedu.nextCourse = nextCourse;
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

