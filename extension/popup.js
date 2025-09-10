// 深学助手弹窗页面 - 带认证系统
const KEY = 'enabledSites';
const API_BASE_URL = 'https://your-vercel-project.vercel.app/api'; // 需要替换为实际的Vercel项目地址

// 错误上报到后台（Sentry）
function report(err, extra = {}) {
  try {
    chrome.runtime.sendMessage({
      action: 'reportError',
      name: (err && err.name) || 'Error',
      message: (err && err.message) || String(err),
      stack: err && err.stack,
      extra: { where: 'popup', ...extra }
    }, () => {});
  } catch (_) {}
}

// 全局兜底错误捕获（popup 页面）
window.addEventListener('error', (e) => {
  try { report(e.error || new Error(String((e && e.message) || 'popup window.error'))); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { const r = e && e.reason; report(r || new Error('popup unhandledrejection')); } catch {}
});

// ============ 认证相关功能 ============

// 认证API调用
async function callAuthAPI(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[深学助手] API调用失败:', error);
    throw new Error('网络连接失败，请检查网络设置');
  }
}

// 获取存储的token
async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userToken'], (result) => {
      resolve(result.userToken || null);
    });
  });
}

// 保存token到存储
async function saveToken(token) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ userToken: token }, resolve);
  });
}

// 清除token
async function clearToken() {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(['userToken'], resolve);
  });
}

// 验证token是否有效
async function verifyToken(token) {
  try {
    const result = await callAuthAPI('verify', { token });
    return result.success;
  } catch {
    return false;
  }
}

// 检查认证状态
async function checkAuthStatus() {
  const token = await getStoredToken();
  if (!token) return null;
  
  const isValid = await verifyToken(token);
  if (!isValid) {
    await clearToken();
    return null;
  }
  
  // 解码JWT获取用户信息
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { token, email: payload.email, userId: payload.userId };
  } catch {
    await clearToken();
    return null;
  }
}

// 用户注册
async function registerUser(email, password, inviteCode) {
  const result = await callAuthAPI('register', { email, password, inviteCode });
  if (result.success) {
    showAuthMessage('注册成功！请使用您的邮箱登录。', 'success');
    // 切换到登录标签
    switchAuthTab('login');
  } else {
    showAuthMessage(result.message || '注册失败', 'error');
  }
}

// 用户登录
async function loginUser(email, password) {
  const result = await callAuthAPI('login', { email, password });
  if (result.success) {
    await saveToken(result.token);
    showAuthMessage('登录成功！', 'success');
    // 延迟一下再更新界面，让用户看到成功消息
    setTimeout(() => {
      updateUIBasedOnAuth();
    }, 1000);
  } else {
    showAuthMessage(result.message || '登录失败', 'error');
  }
}

// 用户登出
async function logoutUser() {
  await clearToken();
  updateUIBasedOnAuth();
}

// 显示认证消息
function showAuthMessage(message, type) {
  const messageElement = document.getElementById('auth-message');
  messageElement.textContent = message;
  messageElement.className = `auth-message ${type}`;
  messageElement.classList.remove('hidden');
  
  // 3秒后自动隐藏消息
  setTimeout(() => {
    messageElement.classList.add('hidden');
  }, 3000);
}

// 切换认证标签
function switchAuthTab(tab) {
  // 更新标签样式
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  // 切换表单
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  
  // 清除之前的消息
  document.getElementById('auth-message').classList.add('hidden');
}

// 根据认证状态更新UI
async function updateUIBasedOnAuth() {
  const authInfo = await checkAuthStatus();
  
  // 获取界面元素
  const authInterface = document.getElementById('auth-interface');
  const authenticatedInterface = document.getElementById('authenticated-interface');
  const supportedSite = document.getElementById('supported-site');
  const unsupportedSite = document.getElementById('unsupported-site');
  
  if (authInfo) {
    // 用户已认证
    authInterface.classList.add('hidden');
    authenticatedInterface.classList.remove('hidden');
    document.getElementById('user-email').textContent = authInfo.email;
    
    // 显示网站相关界面
    checkCurrentSite();
  } else {
    // 用户未认证
    authInterface.classList.remove('hidden');
    authenticatedInterface.classList.add('hidden');
    supportedSite.classList.add('hidden');
    unsupportedSite.classList.add('hidden');
  }
}

// ============ 原有功能（网站检测等） ============

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

async function checkCurrentSite() {
  try {
    const authInfo = await checkAuthStatus();
    if (!authInfo) {
      // 用户未认证，不显示网站功能
      return;
    }
    
    const tab = await getCurrentTab();
    if (!tab) return;

    const platforms = await getPlatforms();
    const matchedPlatform = platforms.find(p => p.domains.some(domain => {
      try {
        const url = new URL(tab.url);
        return url.hostname === domain;
      } catch {
        return false;
      }
    }));

    if (matchedPlatform) {
      // 支持的网站
      supportedSiteElement.classList.remove('hidden');
      unsupportedSiteElement.classList.add('hidden');
      currentSiteElement.textContent = matchedPlatform.name;
      
      // 获取存储的启用状态
      const storage = await chrome.storage.sync.get([KEY]);
      const enabledSites = storage[KEY] || {};
      const isEnabled = enabledSites[matchedPlatform.id] || false;
      
      siteToggleElement.checked = isEnabled;
      updateStatus(isEnabled ? 'active' : 'inactive');
      
      // 获取站点运行状态
      await updateSiteStatus(tab.id);
    } else {
      // 不支持的网站
      try {
        const url = new URL(tab.url);
        supportedSiteElement.classList.add('hidden');
        unsupportedSiteElement.classList.remove('hidden');
        currentSiteUnsupportedElement.textContent = url.hostname;
      } catch {
        currentSiteUnsupportedElement.textContent = '未知网站';
      }
    }
  } catch (error) {
    console.error('[深学助手] 检查当前网站失败:', error);
    report(error, { action: 'checkCurrentSite' });
  }
}

async function updateSiteStatus(tabId) {
  try {
    chrome.runtime.sendMessage({ action: 'getStatus', tabId }, (response) => {
      if (response && response.running) {
        updateStatus('running');
      }
    });
    
    // 检查 Debugger 状态
    chrome.debugger.getTargets((targets) => {
      const isAttached = targets.some(t => t.tabId === tabId && t.attached);
      debuggerDotElement.className = `status-dot ${isAttached ? 'running' : 'inactive'}`;
      debuggerTextElement.textContent = `Debugger: ${isAttached ? '已连接' : '未连接'}`;
    });
  } catch (error) {
    console.error('[深学助手] 获取站点状态失败:', error);
  }
}

function updateStatus(status) {
  const statusMap = {
    inactive: { class: 'inactive', text: '未启用' },
    active: { class: 'status-dot', text: '已启用' },
    running: { class: 'running', text: '运行中' },
    error: { class: 'error', text: '出错' }
  };
  
  const config = statusMap[status] || statusMap.inactive;
  statusDotElement.className = `status-dot ${config.class}`;
  statusTextElement.textContent = config.text;
}

// 事件监听器
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化认证状态
  await updateUIBasedOnAuth();
  
  // 版本信息
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = `v${manifest.version}`;
  
  // 选项页面链接
  optionsLinkElement.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  
  // 认证标签切换
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchAuthTab(tab.dataset.tab);
    });
  });
  
  // 登录按钮
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
      showAuthMessage('请填写完整的登录信息', 'error');
      return;
    }
    
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = '登录中...';
    
    try {
      await loginUser(email, password);
    } catch (error) {
      showAuthMessage(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '登录';
    }
  });
  
  // 注册按钮
  document.getElementById('register-btn').addEventListener('click', async () => {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const inviteCode = document.getElementById('register-invite').value.trim();
    
    if (!email || !password || !inviteCode) {
      showAuthMessage('请填写完整的注册信息', 'error');
      return;
    }
    
    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    btn.textContent = '注册中...';
    
    try {
      await registerUser(email, password, inviteCode);
    } catch (error) {
      showAuthMessage(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '注册';
    }
  });
  
  // 登出按钮
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logoutUser();
  });
  
  // 网站开关
  siteToggleElement.addEventListener('change', async () => {
    try {
      const tab = await getCurrentTab();
      const platforms = await getPlatforms();
      const matchedPlatform = platforms.find(p => p.domains.some(domain => {
        try {
          const url = new URL(tab.url);
          return url.hostname === domain;
        } catch {
          return false;
        }
      }));
      
      if (matchedPlatform) {
        const storage = await chrome.storage.sync.get([KEY]);
        const enabledSites = storage[KEY] || {};
        enabledSites[matchedPlatform.id] = siteToggleElement.checked;
        await chrome.storage.sync.set({ [KEY]: enabledSites });
        
        updateStatus(siteToggleElement.checked ? 'active' : 'inactive');
      }
    } catch (error) {
      console.error('[深学助手] 切换网站状态失败:', error);
      report(error, { action: 'toggleSite' });
    }
  });
});

// Tab变化监听
chrome.tabs.onActivated.addListener(() => {
  updateUIBasedOnAuth();
});

chrome.tabs.onUpdated.addListener(() => {
  updateUIBasedOnAuth();
});