// 深学助手弹窗页面（UTF‑8 清洁版）
const KEY = 'enabledSites';

// 从后台获取平台定义
function getPlatforms() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getPlatformDefinitions' }, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (response) resolve(response);
      else reject(new Error('未能从后台获取平台定义'));
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
const debuggerDotElement = document.getElementById('debugger-dot');
const debuggerTextElement = document.getElementById('debugger-text');

function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

async function getPlatformByDomain(domain) {
  const platforms = await getPlatforms();
  for (const id in platforms) {
    const def = platforms[id];
    if (def && Array.isArray(def.domains) && def.domains.includes(domain)) return def;
  }
  return null;
}

function getSiteConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [KEY]: {} }, (data) => resolve(data[KEY] || {}));
  });
}

async function saveSiteConfigForPlatform(domain, enabled) {
  const platform = await getPlatformByDomain(domain);
  if (!platform) return;
  const config = await getSiteConfig();
  for (const d of platform.domains) config[d] = enabled;
  return new Promise((resolve) => chrome.storage.sync.set({ [KEY]: config }, resolve));
}

function getExtensionStatus(tab) {
  return new Promise((resolve) => {
    if (!tab || !tab.id) return resolve({ active: false, status: 'inactive' });
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) resolve({ active: false, status: 'inactive' });
      else resolve(response || { active: false, status: 'inactive' });
    });
  });
}

function updateStatusIndicator(isEnabled, extensionStatus) {
  if (!isEnabled) {
    statusDotElement.className = 'status-dot inactive';
    statusTextElement.textContent = '已禁用';
    statusTextElement.title = '当前网站的自动化功能已被禁用。您可以在选项页开启。';
  } else if (extensionStatus && extensionStatus.active) {
    statusDotElement.className = 'status-dot running';
    statusTextElement.textContent = '运行中';
    statusTextElement.title = '自动化脚本正在当前页面上活动。';
  } else {
    statusDotElement.className = 'status-dot';
    statusTextElement.textContent = '已启用';
    statusTextElement.title = '自动化功能已准备就绪，将在符合条件的页面自动激活。';
  }
}

function getDebuggerStatus(tabId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getDebugStatus', tabId }, (resp) => {
      if (chrome.runtime.lastError) return resolve({ status: 'unknown' });
      resolve(resp || { status: 'unknown' });
    });
  });
}

function updateDebuggerIndicator(info) {
  const s = (info && info.status) || 'unknown';
  let cls = 'status-dot';
  if (s === 'attached') cls = 'status-dot running';
  else if (s === 'error') cls = 'status-dot error';
  else if (s === 'detached' || s === 'unknown') cls = 'status-dot inactive';
  debuggerDotElement.className = cls;
  const labels = {
    injected: '已注入',
    attached: '已附加',
    error: '错误',
    detached: '已分离',
    unknown: '未知'
  };
  debuggerTextElement.textContent = `调试器：${labels[s] || labels.unknown}`;
  const titles = {
    injected: '已注入并开始工作',
    attached: '已附加，准备注入',
    error: '调试器或注入出错',
    detached: '已分离（当前页面未启用）',
    unknown: '未知状态（可能未匹配）'
  };
  if (s === 'error') {
    const detail = (info && (info.error || info.message)) || '未知错误';
    debuggerTextElement.title = `发生错误: ${detail}`;
  } else {
    debuggerTextElement.title = titles[s] || titles.unknown;
  }
}

async function updateUI(tab, config, extensionStatus) {
  const domain = extractDomain(tab.url || '');
  const platform = domain ? await getPlatformByDomain(domain) : null;
  if (platform) {
    supportedSiteElement.classList.remove('hidden');
    unsupportedSiteElement.classList.add('hidden');
    currentSiteElement.textContent = `${platform.icon} ${platform.name}`;
    const isEnabled = config[domain] !== false; // 默认启用
    siteToggleElement.checked = isEnabled;
    siteToggleElement.disabled = false;
    updateStatusIndicator(isEnabled, extensionStatus);
  } else {
    supportedSiteElement.classList.add('hidden');
    unsupportedSiteElement.classList.remove('hidden');
    currentSiteUnsupportedElement.textContent = domain || '未知域名';
    siteToggleElement.checked = false;
    siteToggleElement.disabled = true;
  }
}

async function handleToggleChange() {
  const tab = await getCurrentTab();
  const domain = extractDomain(tab.url || '');
  const platform = domain ? await getPlatformByDomain(domain) : null;
  if (!platform) return;
  const enabled = siteToggleElement.checked;
  await saveSiteConfigForPlatform(domain, enabled);
  try { chrome.tabs.sendMessage(tab.id, { action: 'configChanged', enabled }); } catch {}
  const extensionStatus = await getExtensionStatus(tab);
  updateStatusIndicator(enabled, extensionStatus);
  chrome.runtime.sendMessage({ action: 'updateIcon', tabId: tab.id, enabled });
}

function openOptionsPage() {
  chrome.runtime.openOptionsPage();
  window.close();
}

async function initializePopup() {
  try {
    const tab = await getCurrentTab();
    if (!tab) {
      console.error('[深学助手] 无法获取当前标签页');
      return;
    }
    const config = await getSiteConfig();
    const extensionStatus = await getExtensionStatus(tab);
    await updateUI(tab, config, extensionStatus);
    const dbg = await getDebuggerStatus(tab.id);
    updateDebuggerIndicator(dbg);
    siteToggleElement.addEventListener('change', handleToggleChange);
    optionsLinkElement.addEventListener('click', (e) => { e.preventDefault(); openOptionsPage(); });
  } catch (error) {
    console.error('[深学助手] 初始化 popup 时出错', error);
  }
}

document.addEventListener('DOMContentLoaded', initializePopup);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'statusUpdate') {
    getCurrentTab().then(async (tab) => {
      const config = await getSiteConfig();
      const domain = extractDomain(tab.url || '');
      const platform = domain ? await getPlatformByDomain(domain) : null;
      if (domain && platform) {
        const isEnabled = config[domain] !== false;
        updateStatusIndicator(isEnabled, message.status);
      }
    });
  }
});

