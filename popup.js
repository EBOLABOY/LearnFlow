// 深学助手弹窗页面 - 使用消息传递架构
// 通过chrome.runtime.sendMessage从后台脚本获取平台定义

const KEY = 'enabledSites';

// 从后台脚本获取平台定义
function getPlatforms() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getPlatformDefinitions' }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (response) {
          resolve(response);
        } else {
          reject(new Error("未能从后台获取平台定义。"));
        }
      });
    });
}

// DOM 元素
const supportedSiteElement = document.getElementById('supported-site');
const unsupportedSiteElement = document.getElementById('unsupported-site');
const currentSiteElement = document.getElementById('current-site');
const currentSiteUnsupportedElement = document.getElementById('current-site-unsupported');
const siteToggleElement = document.getElementById('site-toggle');
const statusDotElement = document.getElementById('status-dot');
const statusTextElement = document.getElementById('status-text');
const optionsLinkElement = document.getElementById('options-link');

// 获取当前活动标签页
function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

// 从URL提取域名
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// 通过域名获取对应的平台（使用消息传递）
async function getPlatformByDomain(domain) {
    const platforms = await getPlatforms();
    for (const platformId in platforms) {
        if (platforms[platformId].domains.includes(domain)) {
            return platforms[platformId];
        }
    }
    return null;
}

// 获取网站配置
function getSiteConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [KEY]: {} }, (data) => {
      resolve(data[KEY] || {});
    });
  });
}

// 保存网站配置（针对平台的所有域名）
async function saveSiteConfigForPlatform(domain, enabled) {
    const platform = await getPlatformByDomain(domain);
    if (!platform) return;
    
    const config = await getSiteConfig();
    
    // 同时更新平台下所有域名的状态
    for (const d of platform.domains) {
        config[d] = enabled;
    }
    
    return new Promise((resolve) => {
        chrome.storage.sync.set({ [KEY]: config }, resolve);
    });
}

// 获取扩展运行状态
function getExtensionStatus(tab) {
  return new Promise((resolve) => {
    if (!tab || !tab.id) {
      resolve({ active: false, status: 'inactive' });
      return;
    }
    
    // 尝试与content script通信来获取状态
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script不存在或无法通信
        resolve({ active: false, status: 'inactive' });
      } else {
        resolve(response || { active: false, status: 'inactive' });
      }
    });
  });
}

// 更新UI状态
async function updateUI(tab, config, extensionStatus) {
    const domain = extractDomain(tab.url);
    const platform = await getPlatformByDomain(domain);
    
    if (platform) {
        // 显示支持网站的界面
        supportedSiteElement.classList.remove('hidden');
        unsupportedSiteElement.classList.add('hidden');
        
        // 设置网站信息
        currentSiteElement.textContent = `${platform.icon} ${platform.name}`;
        
        // 设置开关状态
        const isEnabled = config[domain] !== false; // 默认开启
        siteToggleElement.checked = isEnabled;
        
        // 更新状态指示器
        updateStatusIndicator(isEnabled, extensionStatus);
        
    } else {
        // 显示不支持网站的界面
        supportedSiteElement.classList.add('hidden');
        unsupportedSiteElement.classList.remove('hidden');
        
        // 设置网站信息
        currentSiteUnsupportedElement.textContent = domain || '未知网站';
    }
}

// 更新状态指示器
function updateStatusIndicator(isEnabled, extensionStatus) {
  if (!isEnabled) {
    statusDotElement.className = 'status-dot inactive';
    statusTextElement.textContent = '已禁用';
  } else if (extensionStatus.active) {
    statusDotElement.className = 'status-dot running';
    statusTextElement.textContent = '运行中';
  } else {
    statusDotElement.className = 'status-dot';
    statusTextElement.textContent = '已启用';
  }
}

// 处理开关变化
async function handleToggleChange() {
    const tab = await getCurrentTab();
    const domain = extractDomain(tab.url);
    const platform = await getPlatformByDomain(domain);
    if (!platform) return;
    
    const enabled = siteToggleElement.checked;
    
    // **关键：同时更新平台下所有域名的状态**
    await saveSiteConfigForPlatform(domain, enabled);
    
    // 通知content script配置更改
    chrome.tabs.sendMessage(tab.id, { 
        action: 'configChanged', 
        enabled: enabled 
    }, (response) => {
        // 忽略错误，content script可能尚未注入
    });
    
    // 更新状态显示
    const extensionStatus = await getExtensionStatus(tab);
    updateStatusIndicator(enabled, extensionStatus);
    
    // 通知background script更新图标状态
    chrome.runtime.sendMessage({ 
        action: 'updateIcon', 
        tabId: tab.id, 
        enabled: enabled 
    });
}

// 打开设置页面
function openOptionsPage() {
  chrome.runtime.openOptionsPage();
  window.close(); // 关闭弹窗
}

// 初始化popup
async function initializePopup() {
  try {
    const tab = await getCurrentTab();
    if (!tab) {
      console.error('无法获取当前标签页');
      return;
    }
    
    const config = await getSiteConfig();
    const extensionStatus = await getExtensionStatus(tab);
    
    await updateUI(tab, config, extensionStatus);
    
    // 绑定事件监听器
    siteToggleElement.addEventListener('change', handleToggleChange);
    optionsLinkElement.addEventListener('click', (e) => {
      e.preventDefault();
      openOptionsPage();
    });
    
  } catch (error) {
    console.error('初始化popup时出错:', error);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializePopup);

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'statusUpdate') {
    // 更新扩展运行状态
    getCurrentTab().then(async (tab) => {
      const config = await getSiteConfig();
      const domain = extractDomain(tab.url);
      const platform = await getPlatformByDomain(domain);
      if (domain && platform) {
        const isEnabled = config[domain] !== false;
        updateStatusIndicator(isEnabled, message.status);
      }
    });
  }
});