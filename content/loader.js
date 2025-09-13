(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;
  const API_BASE_URL = 'https://sxapi.izlx.de/api';

  // 检查用户认证状态
  async function checkAuthentication() {
    try {
      // 从扩展存储中获取token
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['userToken'], resolve);
      });

      const token = result.userToken;
      if (!token) {
        console.log('[深学助手] 用户未认证，跳过自动化功能');
        return false;
      }

      // 将网络请求委托给后台脚本
      try {
        const verification = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'verifyToken',
            token: token
          }, (response) => {
            if (chrome.runtime.lastError) {
              // 如果后台脚本出错或无法通信
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });

        if (verification.success) {
          console.log('[深学助手] 用户认证有效，启用自动化功能');
          return true;
        } else {
          console.log('[深学助手] 用户认证已过期，清除本地token');
          // 清除无效token
          chrome.storage.sync.remove(['userToken']);
          return false;
        }
      } catch (error) {
        // 错误可能来自 sendMessage 或 后台的 fetch 失败
        console.warn('[深学助手] 认证验证失败，可能是网络问题:', error);
        // 在网络不佳时，如果本地有token，仍然允许使用，提供更好的离线体验
        const tokenExists = (await new Promise(r => chrome.storage.sync.get(['userToken'], r))).userToken;
        return !!tokenExists;
      }
    } catch (error) {
      console.error('[深学助手] 认证检查出错:', error);
      return false;
    }
  }

  async function run() {
    // 首先检查用户认证状态
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
      // 用户未认证，显示提示信息
      if (ns.util && ns.util.showMessage) {
        ns.util.showMessage('请先在扩展弹窗中登录以使用自动化功能', 5000, 'info');
      }
      return;
    }

    const site = registry.resolve(window.location);
    if (!site) return;

    try {
      try {
        const util = (window.DeepLearn && window.DeepLearn.util) || {};
        if (site) {
          if (typeof util.setTag === 'function') util.setTag('platform_id', site.id);
          if (typeof util.setContext === 'function') util.setContext('page_info', { url: location.href, domain: location.hostname, title: document.title });
          if (typeof util.breadcrumb === 'function') util.breadcrumb('loader', 'site.init', 'info', { siteId: site.id, url: location.href });
          // 添加认证状态到上下文
          if (typeof util.setTag === 'function') util.setTag('user_authenticated', 'true');
        }
      } catch {}

      console.log(`[深学助手] 已认证用户启动站点模块: ${site.id}`);
      site.init();
    } catch (e) {
      console.error('[深学助手] 初始化失败', e);
      try {
        const util = (window.DeepLearn && window.DeepLearn.util) || null;
        if (util && typeof util.reportError === 'function') {
          util.reportError(e, { where: 'content.loader.run', site: site && site.id, domain: location.hostname });
        } else {
          chrome.runtime?.sendMessage && chrome.runtime.sendMessage({ action: 'reportError', name: e?.name, message: e?.message || String(e), stack: e?.stack, extra: { where: 'content.loader.run', site: site && site.id, domain: location.hostname } });
        }
      } catch {}
    }
  }

  // DOM ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
