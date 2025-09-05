// Enhanced background service worker with dynamic icon status management  
// Implements context-aware UX for browser extension action icon

// 使用现代 ES 模块导入语法
import { PLATFORM_DEFINITIONS, getPlatformByDomain } from './src/platforms.js';

const STORAGE_KEY = 'enabledSites';

// 图标状态配置
const ICON_CONFIGS = {
  enabled: {
    "16": "icon16.png",
    "48": "icon48.png", 
    "128": "icon128.png"
  },
  // 可以添加禁用状态的灰色图标，暂时使用系统自动灰化
  disabled: {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
};

// 从URL提取域名
function extractDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// 检查网站是否被支持（使用统一的平台定义）
function isSiteSupported(domain) {
  return getPlatformByDomain(domain) !== null;
}

// 获取站点配置
function getSiteConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: {} }, (data) => {
      resolve(data[STORAGE_KEY] || {});
    });
  });
}

// 更新扩展图标和状态
async function updateActionIcon(tabId, url, config = null) {
  const domain = extractDomain(url);
  const isSupported = isSiteSupported(domain);
  
  if (!config) {
    config = await getSiteConfig();
  }
  
  try {
    if (isSupported) {
      // 在受支持的网站上
      const platform = getPlatformByDomain(domain);
      const isEnabled = config[domain] !== false; // 默认启用
      
      // 启用Action
      await chrome.action.enable(tabId);
      
      // 设置图标（这里可以根据是否启用显示不同图标）
      await chrome.action.setIcon({
        path: ICON_CONFIGS.enabled,
        tabId: tabId
      });
      
      // 设置title提示
      await chrome.action.setTitle({
        tabId: tabId,
        title: `深学助手 - ${platform.name} (${isEnabled ? '已启用' : '已禁用'})`
      });
      
    } else {
      // 在不受支持的网站上
      await chrome.action.disable(tabId);
      
      // 设置图标为禁用状态（Chrome会自动灰化）
      await chrome.action.setIcon({
        path: ICON_CONFIGS.disabled,
        tabId: tabId
      });
      
      // 设置title提示
      await chrome.action.setTitle({
        tabId: tabId,
        title: '深学助手 - 当前网站不支持'
      });
    }
  } catch (error) {
    // 处理图标设置失败（通常发生在扩展更新时）
    if (error.message && error.message.includes('Failed to fetch')) {
      console.log(`[深学助手] 图标资源暂时不可用 (标签页 ${tabId})`);
    } else {
      console.error(`设置图标状态失败 (标签页 ${tabId}):`, error);
    }
  }
}

// 初始化时设置所有已存在标签页的图标状态
async function initializeAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const config = await getSiteConfig();
    
    for (const tab of tabs) {
      if (tab.url && tab.id) {
        await updateActionIcon(tab.id, tab.url, config);
      }
    }
  } catch (error) {
    console.error('初始化标签页图标状态时出错:', error);
  }
}

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("深学助手已安装。可在选项页配置站点开关。");
  
  // 初始化所有标签页的图标状态
  setTimeout(initializeAllTabs, 100);
});

// 扩展启动时的初始化
chrome.runtime.onStartup.addListener(() => {
  console.log("深学助手已启动。");
  setTimeout(initializeAllTabs, 100);
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在页面完全加载后更新图标状态
  if (changeInfo.status === 'complete' && tab.url) {
    await updateActionIcon(tabId, tab.url);
  }
});

// 监听活动标签页切换事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateActionIcon(tab.id, tab.url);
    }
  } catch (error) {
    // 处理竞态条件：标签页在获取前就被关闭了
    if (error.message && error.message.includes('No tab with id')) {
      console.log(`[深学助手] 尝试访问已关闭的标签页: ${activeInfo.tabId}`);
    } else {
      console.error('处理标签页切换时出错:', error);
    }
  }
});

// 监听来自content scripts和popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // --- V 新增：平台定义数据中心 V ---
  if (message?.action === 'getPlatformDefinitions') {
    // 当有页面请求平台定义时，直接返回已加载的对象
    sendResponse(PLATFORM_DEFINITIONS);
    return false; // 同步返回
  }
  // --- ^ 新增代码结束 ^ ---
  
  // 兼容旧版配置消息格式
  if (message?.type === 'get-config') {
    chrome.storage.sync.get({ enabledSites: {} }, (data) => {
      sendResponse({ enabledSites: data.enabledSites || {} });
    });
    return true; // async
  }
  
  if (message?.type === 'set-config') {
    chrome.storage.sync.set({ enabledSites: message.enabledSites || {} }, () => {
      sendResponse({ ok: true });
    });
    return true; // async
  }
  
  // 处理popup发来的图标更新请求
  if (message?.action === 'updateIcon') {
    const { tabId, enabled } = message;
    if (tabId) {
      // 重新获取配置并更新图标
      updateActionIcon(tabId, null).catch(console.error);
    }
    sendResponse({ success: true });
    return false; // 同步响应
  }
  
  // 处理状态查询请求
  if (message?.action === 'getStatus') {
    // 可以在这里返回扩展的运行状态
    sendResponse({ active: true, status: 'running' });
    return false; // 同步响应
  }
  
  return false;
});

// 监听存储变化，当配置更新时重新初始化所有标签页
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[STORAGE_KEY]) {
    console.log('站点配置已更改，更新所有标签页图标状态');
    initializeAllTabs().catch(console.error);
  }
});

