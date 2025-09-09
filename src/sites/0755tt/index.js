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
    // 使用"锁"确保只执行一次
    if (isInitialized || tt.isRunning()) {
      // 已经初始化则停止观察，避免不必要的性能开销
      if (observer) {
        observer.disconnect();
        observer = null;
        console.log('[深学助手] 模式已确定，停止页面变化观察。');
      }
      return;
    }

    const href = location.href;
    
    // 考试模式检测：URL匹配 OR 内容匹配
    const isExamUrl = /\/student\/section/.test(href);
    const examContainer = document.querySelector('.header-head1');
    const isExamContent = !!examContainer;
    
    // 视频模式检测：URL匹配 OR 内容匹配
    const isVideoUrl = /\/video/.test(href);
    const videoContainer = document.querySelector('video, .player-container, #player, .vjs-video-container');
    const isVideoContent = !!videoContainer;

    console.log(`[深学助手] 页面检测 - URL: ${href}, 考试内容: ${isExamContent}, 视频内容: ${isVideoContent}`);

    // 考试模式：URL或内容任一匹配即可启动
    if (isExamUrl || isExamContent) {
      // 如果URL匹配但内容未就绪，等待内容
      if (isExamUrl && !isExamContent) {
        console.log('[深学助手] 考试URL已匹配，等待考试内容加载...');
        return; // 继续观察，等待内容出现
      }
      
      // URL和内容都就绪，正式启动
      isInitialized = true;
      console.log('[深学助手] 章节测试模式已确认启动 - URL匹配:', isExamUrl, '内容匹配:', isExamContent);
      try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 深学助手已启动 (考试模式)', 3000, 'info'); } catch {}
      try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:exam', 'info', { url: href }); } catch {}

      try {
        tt.initExam();
        tt.__running = true;
        console.log('[深学助手] 考试模块启动成功');
      } catch (e) {
        try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initExam' }); } catch {}
        console.error('[深学助手] 考试模块启动失败:', e);
        throw e;
      }
    } 
    // 视频模式：URL或内容任一匹配即可启动
    else if (isVideoUrl || isVideoContent) {
      // 如果URL匹配但内容未就绪，等待内容
      if (isVideoUrl && !isVideoContent) {
        console.log('[深学助手] 视频URL已匹配，等待视频内容加载...');
        return; // 继续观察，等待内容出现
      }
      
      // URL和内容都就绪，正式启动
      isInitialized = true;
      console.log('[深学助手] 视频播放模式已确认启动 - URL匹配:', isVideoUrl, '内容匹配:', isVideoContent);
      try { (ns.util && ns.util.showMessage) && ns.util.showMessage('✅ 深学助手已启动 (视频模式)', 3000, 'info'); } catch {}
      try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:video', 'info', { url: href }); } catch {}
      
      try { 
        tt.initVideo(); 
        tt.__running = true;
        console.log('[深学助手] 视频模块启动成功');
      } catch (e) {
        try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initVideo' }); } catch {}
        console.error('[深学助手] 视频模块启动失败:', e);
        throw e;
      }
    }
    // 继续观察DOM变化，等待页面内容更新
  }

  const site = {
    id: 'www.0755tt.com',
    name: '0755TT 学习平台',
    matches(loc) {
      return /(^|\.)0755tt\.com$/i.test(loc.hostname);
    },
    init() {
      console.log('[深学助手] 启动智能页面监控，持续检测考试和视频模式...');
      
      const startObserver = () => {
        // 立即检查一次当前状态
        checkAndRun();

        // 无论初次检查结果如何，都启动持续观察（针对SPA时序问题）
        if (!isInitialized) {
          try {
            observer = new MutationObserver(() => {
              checkAndRun();
            });
            observer.observe(document.body, { 
              childList: true, 
              subtree: true,
              attributes: false, // 减少不必要的属性变化监控
              characterData: false // 减少文本变化监控
            });
            console.log('[深学助手] MutationObserver 已启动，监控页面内容变化...');
          } catch (e) {
            console.error('[深学助手] 启动页面观察器失败:', e);
          }
        }
      };

      // 确保在document.body存在后启动
      if (document.body) {
        startObserver();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          startObserver();
        }, { once: true });
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




