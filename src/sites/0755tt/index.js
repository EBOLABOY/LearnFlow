(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  // 运行状态标记，供弹窗查询
  tt.__running = tt.__running || false;
  tt.isRunning = () => !!tt.__running;

  // 防止 SPA 中重复初始化
  let isInitialized = false;
  // 让 checkAndRun 与 init 共享观察器
  let observer = null;

  function checkAndRun() {
    if (isInitialized || tt.isRunning()) return;

    const href = location.href;

    if (/\/student\/section/.test(href)) {
      isInitialized = true;
      console.log('[深学助手] 章节测试模式已匹配，启动中...');
      try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 深学助手已启动 (考试模式)', 3000, 'info'); } catch {}
      try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:exam', 'info', { url: href }); } catch {}

      // --- 新增的关键代码 ---
      // 等待页面上任意一个<button>元素渲染完成，最长等待10秒
      util.waitForElement('button', 10000)
        .then(() => {
            console.log('[深学助手] 页面按钮已渲染，正式启动考试模块。');
            try {
                tt.initExam();
                tt.__running = true;
            } catch (e) {
                try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initExam' }); } catch {}
                throw e;
            }
        })
        .catch(err => {
            console.error("[深学助手] 等待考试页面关键元素（按钮）超时，无法启动考试模块。", err);
            try { (ns.util && ns.util.showMessage) && ns.util.showMessage('❌ 错误：未找到考试入口，请刷新页面重试。', 8000, 'error'); } catch {}
        });
      // --- 新增代码结束 ---
      
      if (observer) {
        try { observer.disconnect(); } catch {}
      }
    } else if (/\/video/.test(href)) {
      isInitialized = true;
      console.log('[深学助手] 视频播放模式已匹配，启动中...');
      try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 深学助手已启动 (视频模式)', 3000, 'info'); } catch {}
      try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:video', 'info', { url: href }); } catch {}
      try { tt.initVideo(); tt.__running = true; } catch (e) {
        try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initVideo' }); } catch {}
        throw e;
      }
      if (observer) {
        try { observer.disconnect(); } catch {}
      }
    }
    // 不匹配时保持沉默，等待后续 DOM 变化再次检查
  }

  const site = {
    id: 'www.0755tt.com',
    name: '0755TT 学习平台',
    matches(loc) {
      return /(^|\.)0755tt\.com$/i.test(loc.hostname);
    },
    init() {
      // 首次尝试
      checkAndRun();

      // 首次未匹配时，观察 SPA 的 DOM 变化
      if (!isInitialized) {
        console.log('[深学助手] 页面初次加载未匹配模式，启动 MutationObserver 等待页面变化...');
        const startObserve = () => {
          try {
            observer = new MutationObserver(() => {
              checkAndRun();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {
            // body 尚不可用时，等 DOMContentLoaded 再试
            document.addEventListener('DOMContentLoaded', () => {
              try {
                observer = new MutationObserver(() => {
                  checkAndRun();
                });
                observer.observe(document.body, { childList: true, subtree: true });
              } catch {}
            }, { once: true });
          }
        };
        if (document.body) startObserve(); else startObserve();
      }
    },
  };

  registry.register(site);

  // 响应弹窗状态查询
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'getStatus') {
        sendResponse({ active: tt.isRunning(), status: tt.__running ? 'running' : 'idle' });
      }
    });
  } catch (_) {}
})();




