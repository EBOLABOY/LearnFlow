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
      try { site.init(); } catch (e) { console.error('[深学助手] 初始化失败', e); }
    });
  }

  // DOM ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') run();
  else document.addEventListener('DOMContentLoaded', run);
})();

