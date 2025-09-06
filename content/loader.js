(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;

  function run() {
    const site = registry.resolve(window.location);
    if (!site) return;

    // check enabled from storage
    chrome.storage?.sync?.get({ enabledSites: {} }, (data) => {
      const enabledSites = data?.enabledSites || {};
      // 使用当前域名而不是抽象站点ID来检查启用状态
      const currentDomain = window.location.hostname;
      const enabled = enabledSites[currentDomain];
      if (enabled === false) {
        console.log(`[深学助手] 站点 ${currentDomain} 已禁用，跳过`);
        return;
      }
      try {
        try {
          const util = (window.DeepLearn && window.DeepLearn.util) || {};
          if (site) {
            if (typeof util.setTag === 'function') util.setTag('platform_id', site.id);
            if (typeof util.setContext === 'function') util.setContext('page_info', { url: location.href, domain: location.hostname, title: document.title });
            if (typeof util.breadcrumb === 'function') util.breadcrumb('loader', 'site.init', 'info', { siteId: site.id, url: location.href });
          }
        } catch {}
        site.init();
      } catch (e) {
        console.error('[深学助手] 初始化失败', e);
        try {
          const util = (window.DeepLearn && window.DeepLearn.util) || null;
          if (util && typeof util.reportError === 'function') {
            util.reportError(e, { where: 'content.loader.run', site: site && site.id, domain: currentDomain });
          } else {
            chrome.runtime?.sendMessage && chrome.runtime.sendMessage({ action: 'reportError', name: e?.name, message: e?.message || String(e), stack: e?.stack, extra: { where: 'content.loader.run', site: site && site.id, domain: currentDomain } });
          }
        } catch {}
      }
    });
  }

  // DOM ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') run();
  else document.addEventListener('DOMContentLoaded', run);
})();

