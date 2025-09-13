// 深学助手弹窗页面 - 企业级认证UI
// 认证 API 根地址（登录/注册/校验）
const API_BASE_URL = 'https://sxapi.izlx.de/api';

// ============ 全局状态管理 ============
const state = {
  user: null,
  currentTab: null,
  currentSite: null,
  isLoading: false,
  message: null
};

// ============ 错误处理和上报 ============
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

// 全局兜底错误捕获
window.addEventListener('error', (e) => {
  try { report(e.error || new Error(String((e && e.message) || 'popup window.error'))); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { const r = e && e.reason; report(r || new Error('popup unhandledrejection')); } catch {}
});

// ============ 工具函数 ============
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function addClass(element, className) {
  if (element && !element.classList.contains(className)) {
    element.classList.add(className);
  }
}

function removeClass(element, className) {
  if (element && element.classList.contains(className)) {
    element.classList.remove(className);
  }
}

function toggleClass(element, className, condition) {
  if (condition) {
    addClass(element, className);
  } else {
    removeClass(element, className);
  }
}

// 密码复杂度校验：至少8位，且包含四类中的至少三类（大写/小写/数字/符号）
function isPasswordStrong(password) {
  if (!password || password.length < 8) return false;
  const cats = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)];
  return cats.filter(Boolean).length >= 3;
}

// ============ 认证API服务 ============
class AuthAPI {
  static async call(endpoint, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'proxyFetch',
        endpoint: endpoint,
        data: data
      }, (response) => {
        if (chrome.runtime.lastError) {
          // 如果后台脚本出错或无法通信
          console.error('[深学助手] API代理调用失败:', chrome.runtime.lastError.message);
          return reject(new Error('与后台服务通信失败'));
        }
        if (response && response.success) {
          resolve(response.data);
        } else {
          // 后台返回了业务错误或网络错误
          console.error(`[深学助手] API [${endpoint}] 错误:`, response.error);
          reject(new Error(response.error || '未知API错误'));
        }
      });
    });
  }

  static async register(email, password, inviteCode) {
    return this.call('register', { email, password, inviteCode });
  }

  static async login(email, password) {
    return this.call('login', { email, password });
  }

  static async verify(token) {
    return this.call('verify', { token });
  }
}

// ============ 存储服务 ============
class StorageService {
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }

  static async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.remove([key], resolve);
    });
  }

  static async getToken() {
    return this.get('userToken');
  }

  static async setToken(token) {
    return this.set('userToken', token);
  }

  static async removeToken() {
    return this.remove('userToken');
  }
}

// ============ 认证服务 ============
class AuthService {
  static async checkStatus() {
    const token = await StorageService.getToken();
    if (!token) return null;
    
    try {
      const result = await AuthAPI.verify(token);
      if (result.success) {
        // 解码JWT获取用户信息
        const payload = JSON.parse(atob(token.split('.')[1]));
        return { token, email: payload.email, userId: payload.userId };
      } else {
        await StorageService.removeToken();
        return null;
      }
    } catch (error) {
      await StorageService.removeToken();
      return null;
    }
  }

  static async login(email, password) {
    const result = await AuthAPI.login(email, password);
    if (result.success) {
      await StorageService.setToken(result.token);
      return result;
    }
    throw new Error(result.message || '登录失败');
  }

  static async register(email, password, inviteCode) {
    const result = await AuthAPI.register(email, password, inviteCode);
    if (!result.success) {
      throw new Error(result.message || '注册失败');
    }
    return result;
  }

  static async logout() {
    await StorageService.removeToken();
  }
}

// ============ 网站服务 ============
class SiteService {
  static async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
    });
  }

  static async getPlatforms() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getPlatformDefinitions' }, (response) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        if (response) resolve(response);
        else reject(new Error('未能从后台获取平台定义'));
      });
    });
  }

  static async findMatchedPlatform(tab) {
    try {
      const platforms = await this.getPlatforms();
      return platforms.find(p => p.domains.some(domain => {
        try {
          const url = new URL(tab.url);
          return url.hostname === domain;
        } catch {
          return false;
        }
      }));
    } catch (error) {
      console.error('[深学助手] 获取平台定义失败:', error);
      return null;
    }
  }

}

// ============ UI管理器 ============
class UIManager {
  static init() {
    this.elements = {
      // 视图容器
      loadingView: document.getElementById('loading-view'),
      authView: document.getElementById('auth-view'),
      authenticatedView: document.getElementById('authenticated-view'),
      siteControlView: document.getElementById('site-control-view'),
      
      // 认证表单
      loginTab: document.getElementById('login-tab'),
      registerTab: document.getElementById('register-tab'),
      loginForm: document.getElementById('login-form'),
      registerForm: document.getElementById('register-form'),
      
      // 表单字段
      loginEmail: document.getElementById('login-email'),
      loginPassword: document.getElementById('login-password'),
      registerEmail: document.getElementById('register-email'),
      registerPassword: document.getElementById('register-password'),
      registerPasswordConfirm: document.getElementById('register-password-confirm'),
      registerInvite: document.getElementById('register-invite'),
      
      // 按钮
      loginBtn: document.getElementById('login-btn'),
      registerBtn: document.getElementById('register-btn'),
      logoutBtn: document.getElementById('logout-btn'),
      
      // 消息和用户信息
      authMessage: document.getElementById('auth-message'),
      messageText: document.querySelector('.message-text'),
      userEmail: document.getElementById('user-email'),
      
      // 网站控制
      supportedSite: document.getElementById('supported-site'),
      unsupportedSite: document.getElementById('unsupported-site'),
      currentSite: document.getElementById('current-site'),
      currentSiteUnsupported: document.getElementById('current-site-unsupported'),
      mainStatus: document.getElementById('main-status'),
      mainStatusText: document.getElementById('main-status-text'),
      debuggerStatus: document.getElementById('debugger-status'),
      debuggerStatusText: document.getElementById('debugger-status-text'),
      
      // 其他
      optionsLink: document.getElementById('options-link'),
      version: document.getElementById('version'),
      
      // 底部操作区
      footerActions: document.querySelector('.footer-actions')
    };
    
    // 运行时微调：占位符与密码规则提示
    try {
      if (this.elements.registerPassword) {
        this.elements.registerPassword.placeholder = '至少8位，且含三类字符';
        if (!this.elements.registerPassword.parentNode.querySelector('.form-hint')) {
          const hint = document.createElement('div');
          hint.className = 'form-hint';
          hint.textContent = '密码需至少8位，且包含大写/小写/数字/符号四类中的至少三类。';
          this.elements.registerPassword.insertAdjacentElement('afterend', hint);
        }
      }
      if (this.elements.registerPasswordConfirm) {
        this.elements.registerPasswordConfirm.placeholder = '请再次输入密码';
      }
    } catch {}

    // 显示扩展版本号（从manifest读取，避免硬编码）
    try {
      const manifest = chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
      const ver = manifest && typeof manifest.version === 'string' ? manifest.version : '';
      if (this.elements.version) {
        this.elements.version.textContent = ver ? `v${ver}` : '';
      }
    } catch {}

    this.bindEvents();
  }

  static bindEvents() {
    // Tab切换
    this.elements.loginTab.addEventListener('click', () => this.switchAuthTab('login'));
    this.elements.registerTab.addEventListener('click', () => this.switchAuthTab('register'));
    
    // 认证按钮
    this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
    this.elements.registerBtn.addEventListener('click', () => this.handleRegister());
    // 回车提交注册表单
    this.elements.registerForm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleRegister();
      }
    });
    this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
    
    // 网站开关
    
    // 选项链接
    this.elements.optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  static switchAuthTab(tab) {
    // 更新Tab样式
    toggleClass(this.elements.loginTab, 'active', tab === 'login');
    toggleClass(this.elements.registerTab, 'active', tab === 'register');
    
    // 切换表单
    toggleClass(this.elements.loginForm, 'hidden', tab !== 'login');
    toggleClass(this.elements.registerForm, 'hidden', tab !== 'register');
    
    // 清除消息
    this.hideMessage();
  }

  static async handleLogin() {
    const email = this.elements.loginEmail.value.trim();
    const password = this.elements.loginPassword.value;
    
    if (!email || !password) {
      this.showMessage('请填写完整的登录信息', 'error');
      return;
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage('请输入有效的邮箱地址', 'error');
      return;
    }
    
    this.setButtonLoading(this.elements.loginBtn, true);
    
    try {
      await AuthService.login(email, password);
      this.showMessage('登录成功！', 'success');
      setTimeout(() => {
        App.updateState();
      }, 1000);
    } catch (error) {
      this.showMessage(error.message, 'error');
    } finally {
      this.setButtonLoading(this.elements.loginBtn, false);
    }
  }

  static async handleRegister() {
    const email = this.elements.registerEmail.value.trim();
    const password = this.elements.registerPassword.value;
    const passwordConfirm = this.elements.registerPasswordConfirm.value;
    const inviteCode = this.elements.registerInvite.value.trim();
    if (this.elements.registerBtn && this.elements.registerBtn.disabled) { return; }
    
    if (!email || !password || !passwordConfirm || !inviteCode) {
      this.showMessage('请填写完整的注册信息', 'error');
      return;
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage('请输入有效的邮箱地址', 'error');
      return;
    }
    
    // 密码强度验证
    if (!isPasswordStrong(password)) {
      this.showMessage('密码至少需要6位字符', 'error');
      return;
    }

    // 确认密码一致
    if (password !== passwordConfirm) {
      this.showMessage('两次输入的密码不一致', 'error');
      return;
    }
    
    this.setButtonLoading(this.elements.registerBtn, true);
    
    try {
      await AuthService.register(email, password, inviteCode);
      this.showMessage('注册成功！请使用您的邮箱登录。', 'success');
      setTimeout(() => {
        this.switchAuthTab('login');
      }, 1500);
    } catch (error) {
      this.showMessage(error.message, 'error');
    } finally {
      this.setButtonLoading(this.elements.registerBtn, false);
    }
  }

  static async handleLogout() {
    await AuthService.logout();
    App.updateState();
  }


  static setButtonLoading(button, loading) {
    toggleClass(button, 'loading', loading);
    button.disabled = loading;
    
    const spinner = button.querySelector('.loading-spinner');
    const text = button.querySelector('.btn-text');
    
    if (loading) {
      if (button === this.elements.loginBtn) {
        text.textContent = '登录中...';
      } else if (button === this.elements.registerBtn) {
        text.textContent = '注册中...';
      }
    } else {
      if (button === this.elements.loginBtn) {
        text.textContent = '立即登录';
      } else if (button === this.elements.registerBtn) {
        text.textContent = '创建账户';
      }
    }
  }

  static showMessage(message, type = 'info') {
    this.elements.messageText.textContent = message;
    this.elements.authMessage.className = `auth-message ${type}`;
    removeClass(this.elements.authMessage, 'hidden');
    
    // 自动隐藏成功消息
    if (type === 'success') {
      setTimeout(() => this.hideMessage(), 3000);
    }
  }

  static hideMessage() {
    addClass(this.elements.authMessage, 'hidden');
  }

  static render() {
    // 加载中优先展示加载视图
    if (state.isLoading) {
      removeClass(this.elements.loadingView, 'hidden');
      addClass(this.elements.authView, 'hidden');
      addClass(this.elements.authenticatedView, 'hidden');
      addClass(this.elements.siteControlView, 'hidden');
      addClass(this.elements.footerActions, 'hidden');
      return;
    } else {
      addClass(this.elements.loadingView, 'hidden');
    }
    // 隐藏所有视图
    addClass(this.elements.authView, 'hidden');
    addClass(this.elements.authenticatedView, 'hidden');
    addClass(this.elements.siteControlView, 'hidden');
    
    if (!state.user) {
      // 未登录状态 - 显示认证视图
      removeClass(this.elements.authView, 'hidden');
      // 隐藏底部操作区
      addClass(this.elements.footerActions, 'hidden');
    } else {
      // 已登录状态 - 显示用户信息
      removeClass(this.elements.authenticatedView, 'hidden');
      this.elements.userEmail.textContent = state.user.email;
      // 显示底部操作区
      removeClass(this.elements.footerActions, 'hidden');
      
      // 如果有当前网站信息，显示网站控制视图
      if (state.currentSite) {
        removeClass(this.elements.siteControlView, 'hidden');
        this.renderSiteControl();
      }
    }
    
    // 更新版本信息
    const manifest = chrome.runtime.getManifest();
    this.elements.version.textContent = `v${manifest.version}`;
  }

  static async renderSiteControl() {
    if (!state.currentSite) return;
    
    try {
      // 显示支持的网站
      removeClass(this.elements.supportedSite, 'hidden');
      addClass(this.elements.unsupportedSite, 'hidden');
      
      this.elements.currentSite.textContent = state.currentSite.name;
      
      this.updateSiteStatus('active');
      
      // 更新调试器状态
      this.updateDebuggerStatus();
    } catch (error) {
      // 显示不支持的网站
      addClass(this.elements.supportedSite, 'hidden');
      removeClass(this.elements.unsupportedSite, 'hidden');
      
      try {
        const url = new URL(state.currentTab.url);
        this.elements.currentSiteUnsupported.textContent = url.hostname;
      } catch {
        this.elements.currentSiteUnsupported.textContent = '未知网站';
      }
    }
  }


  static updateSiteStatus(status) {
    const statusMap = {
      active: { class: 'active', text: '功能已激活' },
      running: { class: 'running', text: '运行中' },
      error: { class: 'error', text: '出错' }
    };
    
    const config = statusMap[status] || statusMap.active;
    this.elements.mainStatus.className = `status-indicator ${config.class}`;
    this.elements.mainStatusText.textContent = config.text;
  }

  static updateDebuggerStatus() {
    if (!state.currentTab) return;
    
    chrome.debugger.getTargets((targets) => {
      const isAttached = targets.some(t => t.tabId === state.currentTab.id && t.attached);
      this.elements.debuggerStatus.className = `status-indicator ${isAttached ? 'running' : 'inactive'}`;
      this.elements.debuggerStatusText.textContent = `调试器: ${isAttached ? '已连接' : '未连接'}`;
    });
  }
}

// ============ 应用主控制器 ============
class App {
  static async init() {
    try {
      UIManager.init();
      await this.updateState();
      
      // 监听标签页变化
      chrome.tabs.onActivated.addListener(debounce(() => this.updateState(), 300));
      chrome.tabs.onUpdated.addListener(debounce(() => this.updateState(), 300));
      
    } catch (error) {
      console.error('[深学助手] 应用初始化失败:', error);
      report(error, { where: 'App.init' });
    }
  }

  static async updateState() {
    try {
      // 进入加载状态并渲染加载视图
      state.isLoading = true;
      UIManager.render();
      // 检查认证状态
      state.user = await AuthService.checkStatus();
      
      // 获取当前标签页信息
      state.currentTab = await SiteService.getCurrentTab();
      
      // 如果用户已登录，获取当前网站信息
      if (state.user && state.currentTab) {
        state.currentSite = await SiteService.findMatchedPlatform(state.currentTab);
      } else {
        state.currentSite = null;
      }
      
      // 结束加载并渲染UI
      state.isLoading = false;
      UIManager.render();
      
    } catch (error) {
      console.error('[深学助手] 状态更新失败:', error);
      report(error, { where: 'App.updateState' });
      // 出错也结束加载态，避免卡住
      state.isLoading = false;
      UIManager.render();
    }
  }
}

// ============ 应用启动 ============
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
