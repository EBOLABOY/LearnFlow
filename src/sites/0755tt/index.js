(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});
  const util = ns.util || {};

  tt.__running = tt.__running || false;
  tt.isRunning = () => !!tt.__running;

  function checkAndRun() {
    if (tt.isRunning()) return;

    const href = location.href;
    const isExamUrl = /\/student\/section/.test(href);
    const isVideoUrl = /\/video/.test(href);
    const isExamContent = !!document.querySelector('.header-head1');
    const isVideoContent = !!document.querySelector('video, .player-container, #player, .vjs-video-container');

    // 考试模式
    if (isExamUrl || isExamContent) {
      if (isExamUrl && !isExamContent) return; // 等待DOM
      try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 深学助手已启动 (考试模式)', 3000, 'info'); } catch {}
      try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:exam', 'info', { url: href }); } catch {}
      try {
        tt.initExam();
        tt.__running = true;
      } catch (e) {
        try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initExam' }); } catch {}
        console.error('[深学助手] 考试模式初始化失败:', e);
      }
      return;
    }

    // 视频模式
    if (isVideoUrl || isVideoContent) {
      if (isVideoUrl && !isVideoContent) return;
      try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 深学助手已启动 (视频模式)', 3000, 'info'); } catch {}
      try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:video', 'info', { url: href }); } catch {}
      try {
        tt.initVideo && tt.initVideo();
        tt.__running = true;
      } catch (e) {
        try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initVideo' }); } catch {}
        console.error('[深学助手] 视频模式初始化失败:', e);
      }
      return;
    }
  }

  const site = {
    id: 'www.0755tt.com',
    name: '0755TT 学习平台',
    matches(loc) {
      return /(^|\.)0755tt\.com$/i.test(loc.hostname);
    },
    init() {
      console.log('[深学助手] 站点已加载，检测考试/视频模式 ...');
      // Fallback: ensure Exam Agent is injected even if debugger attach fails (e.g., DevTools open)
      try {
        const injected = window.__DEEPL_EXAM_AGENT_READY__ === true;
        if (!injected && chrome?.runtime?.getURL) {
          const inject = (src) => { try { const s = document.createElement('script'); s.src = chrome.runtime.getURL(src); (document.head || document.documentElement).appendChild(s); } catch {} };
          inject('injected/common/message-bridge.js');
          inject('injected/agents/exam-agent.js');
          console.log('[深学助手] 已尝试以内容脚本回退方式注入 Exam Agent');
        }
      } catch {}

      const run = () => { try { checkAndRun(); } catch (e) { console.error('[深学助手] checkAndRun 出错:', e); } };
      run();

      // DOM 变更观察（SPA兼容）
      try {
        const debounced = util?.debounce?.(run, 500) || run;
        const observer = new MutationObserver(debounced);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        console.log('[深学助手] MutationObserver 监控页面变化...');
      } catch (e) {
        console.error('[深学助手] 页面观察失败:', e);
      }

      // 完成事件，恢复检查（便于“再测一次”）
      try {
        window.addEventListener('deeplearn:examFinished', () => {
          tt.__running = false;
          run();
        });
      } catch {}
    },
  };

  registry.register(site);

  // 状态查询
  try {
    chrome.runtime?.onMessage?.addListener?.((message, sender, sendResponse) => {
      if (message && message.action === 'getStatus') {
        sendResponse({ active: tt.isRunning(), status: tt.__running ? 'running' : 'idle' });
      }
    });
  } catch (_) {}
})();
