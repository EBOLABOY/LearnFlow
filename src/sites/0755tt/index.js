(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});
  // 运行状态标记，供弹窗查询
  tt.__running = tt.__running || false;
  tt.isRunning = () => !!tt.__running;

  const site = {
    id: 'www.0755tt.com',
    name: '0755TT 学习平台',
    matches(loc) {
      return /(^|\.)0755tt\.com$/i.test(loc.hostname);
    },
    init() {
      const href = location.href;
      if (/\/student\/section/.test(href)) {
        console.log('[深学助手] 章节测试模式');
        try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:exam', 'info', { url: href }); } catch {}
        try { tt.initExam(); tt.__running = true; } catch (e) {
          try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initExam' }); } catch {}
          throw e;
        }
      } else if (/\/video/.test(href)) {
        console.log('[深学助手] 视频播放模式');
        try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:video', 'info', { url: href }); } catch {}
        try { tt.initVideo(); tt.__running = true; } catch (e) {
          try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'tt0755.index', where: 'initVideo' }); } catch {}
          throw e;
        }
      } else {
        console.log('[深学助手] 当前页面未匹配到具体模式');
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

