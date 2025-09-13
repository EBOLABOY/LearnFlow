// DeepLearn Assistant - Background (MV3, ESM)
// - Dynamic action icon + title
// - Config-driven Debugger/CDP attach + agent injection
// - Popup messaging for platform definitions and debugger status

// Sentry SDK for error monitoring
import * as Sentry from "@sentry/browser";

import { PLATFORM_DEFINITIONS, getPlatformByDomain } from '../src/platforms.js';

const CDP_VERSION = '1.3';

// Initialize Sentry
try {
  const manifest = chrome.runtime.getManifest();
  const extensionVersion = manifest?.version || '0.0.0';

  Sentry.init({
    dsn: "https://e9ce9d588ddea166b17350023463b1b2@o4509971357040640.ingest.us.sentry.io/4509971467730944",
    release: `deeplearn-assistant@${extensionVersion}`,
    environment: manifest?.version?.includes('dev') ? 'development' : 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1, // 降低采样率以减少数据量
    sendDefaultPii: false, // 确保不发送PII信息
    beforeSend(event) {
      // 过滤掉一些非关键错误
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null; // 不上报网络错误
      }

      // 为错误事件添加上下文信息
      if (event.tags) {
        event.tags.component = 'background';
        event.tags.extension_version = extensionVersion;
      }

      return event;
    }
  });

  // 设置全局用户上下文
  Sentry.setContext('extension', {
    version: extensionVersion,
    manifest_version: manifest?.manifest_version || 3,
    browser: navigator.userAgent.includes('Chrome') ? 'chrome' : 'unknown'
  });

  console.log('[DeepLearn][Sentry] 初始化成功');
} catch (e) {
  // Avoid crashing the service worker on init failures
  console.warn('[DeepLearn][Sentry] init failed:', e);
}

// 获取用户标识信息（用于Sentry上下文，不包含敏感信息）
async function getUserIdentificationForSentry() {
  try {
    // 生成或获取匿名用户ID
    const result = await chrome.storage.local.get(['anonymousUserId', 'installDate', 'sessionCount']);

    let anonymousId = result.anonymousUserId;
    if (!anonymousId) {
      // 生成匿名ID（基于时间戳和随机数）
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await chrome.storage.local.set({ anonymousUserId: anonymousId });
    }

    // 记录安装日期
    let installDate = result.installDate;
    if (!installDate) {
      installDate = new Date().toISOString();
      await chrome.storage.local.set({ installDate });
    }

    // 更新会话计数
    const sessionCount = (result.sessionCount || 0) + 1;
    await chrome.storage.local.set({ sessionCount });


    // 获取当前用户在各平台的非敏感标识
    let platformUser = 'anonymous';
    try {
      // 尝试从各平台localStorage获取非敏感的用户标识
      // 注意：不获取真实用户名或敏感信息，只获取平台ID等
      const tabs = await chrome.tabs.query({ active: true });
      if (tabs.length > 0) {
        const domain = extractDomain(tabs[0].url);
        const platform = domain ? getPlatformByDomain(domain) : null;
        if (platform) {
          platformUser = `${platform.id}_user`;
        }
      }
    } catch {}

    return {
      anonymousId,
      installDate,
      sessionCount,
      enabledPlatforms,
      platformUser
    };
  } catch (error) {
    console.warn('[DeepLearn] 获取用户标识失败:', error);
    return null;
  }
}

// Debugger + status state
const ATTACHED_TABS = new Set();         // Set<number>
const ATTACHING_TABS = new Set();        // Set<number> (reentry guard)
const DEBUG_STATUS = new Map();          // tabId -> { status, rule, error, ts }
const TAB_STATE = new Map();             // tabId -> { lastUrl, lastRulePattern }
const CDP_REPORTED = new Map();          // tabId -> Set<requestId or url>
const CDP_SENT_ON_TAB = new Map();       // tabId -> boolean (first-success policy)

const ICONS = {
  enabled: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' },
  disabled: { '16': 'icons/icon16_disabled.png', '48': 'icons/icon48_disabled.png', '128': 'icons/icon128_disabled.png' },
  // 使用一套灰度图标文件（当前为占位文件，可替换为真正灰度版本）
  disabled_gray: { '16': 'icons/icon16_disabled.png', '48': 'icons/icon48_disabled.png', '128': 'icons/icon128_disabled.png' }
};

//

function extractDomain(url) {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return null; }
}
function isSupported(domain) { return !!getPlatformByDomain(domain); }


function setDebugStatus(tabId, patch) {
  const prev = DEBUG_STATUS.get(tabId) || {};
  const next = { ...prev, ...patch, ts: Date.now() };
  DEBUG_STATUS.set(tabId, next);
}

async function updateActionIcon(tabId, url) {
  const domain = extractDomain(url);
  const supported = isSupported(domain);
  try {
    if (supported) {
      await chrome.action.enable(tabId);
      await chrome.action.setIcon({ path: ICONS.enabled, tabId });
      const platform = getPlatformByDomain(domain);
      await chrome.action.setTitle({ tabId, title: `DeepLearn Assistant - ${platform?.name || 'Helper'}` });
    } else {
      await chrome.action.disable(tabId);
      await chrome.action.setIcon({ path: ICONS.disabled, tabId });
      await chrome.action.setTitle({ tabId, title: 'DeepLearn Assistant - Unsupported site' });
    }
  } catch (e) {
    console.error('[DeepLearn] set icon/title failed:', e);
  }
}

// Rule resolver (config-driven)
async function resolveDebuggerRule(url) {
  const domain = extractDomain(url);
  if (!domain) return null;
  const platform = getPlatformByDomain(domain);
  if (!platform) return null;

  const rules = Array.isArray(platform.debugger_rules) ? platform.debugger_rules : [];
  for (const r of rules) {
    if (!r || !r.url_pattern) continue;
    if (url.includes(r.url_pattern)) return { platformId: platform.id, agent_script: r.agent_script, url_pattern: r.url_pattern };
  }
  return null;
}

async function detachDebugger(tabId, reason = 'detached') {
  if (!ATTACHED_TABS.has(tabId)) {
    // Ensure state cleared anyway
    setDebugStatus(tabId, { status: reason, error: undefined });
    return;
  }
  try {
    await chrome.debugger.detach({ tabId });
    console.log(`[DeepLearn][Debugger] Detached from tab ${tabId}`);
  } catch (e) {
    // Most likely tab already closed; treat as benign
    console.log(`[DeepLearn][Debugger] Detach benign failure for tab ${tabId}: ${e?.message || e}`);
  } finally {
    ATTACHED_TABS.delete(tabId);
    ATTACHING_TABS.delete(tabId);
    setDebugStatus(tabId, { status: reason, error: undefined });
    TAB_STATE.delete(tabId);
    CDP_REPORTED.delete(tabId);
    CDP_SENT_ON_TAB.delete(tabId);
  }
}

async function attachDebuggerAndInject(tabId, url, rule) {
  if (ATTACHED_TABS.has(tabId)) {
    // Already attached; try inject only if needed
  } else {
    if (ATTACHING_TABS.has(tabId)) return; // reentry guard
    ATTACHING_TABS.add(tabId);
  try {
    await chrome.debugger.attach({ tabId }, CDP_VERSION);
    ATTACHED_TABS.add(tabId);
    setDebugStatus(tabId, { status: 'attached', rule });
      try { Sentry.addBreadcrumb({ category: 'debugger', message: 'attached', level: 'info', data: { tabId, url } }); } catch {}
    } catch (e) {
      ATTACHING_TABS.delete(tabId);
      console.error('[DeepLearn][Debugger] attach failed:', e);
      setDebugStatus(tabId, { status: 'error', error: String(e), rule });
      return;
    } finally {
      ATTACHING_TABS.delete(tabId);
    }
  }

  // Enable domains + bypass CSP
  const send = (method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);
  try {
    await send('Runtime.enable');
    await send('Network.enable');
    try { await send('Page.enable'); } catch {}
    try { await send('Page.setBypassCSP', { enabled: true }); } catch {}
    console.log('[DeepLearn][Debugger] Enabled Runtime/Network and bypassed CSP');
    try { Sentry.addBreadcrumb({ category: 'debugger', message: 'domains enabled + bypass CSP', level: 'info', data: { tabId } }); } catch {}
  } catch (e) {
    console.warn('[DeepLearn][Debugger] enable domains failed:', e);
  }

  // Helper to build a safe Runtime.evaluate expression for injecting an agent
  function buildInjectionExpression(agentRelativePath) {
    try {
      const scriptUrl = chrome.runtime.getURL(agentRelativePath);
      const bridgeUrl = chrome.runtime.getURL('injected/common/message-bridge.js');
      const version = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '';
      const escapedUrl = scriptUrl.replace(/'/g, "\\'");
      const escapedBridge = bridgeUrl.replace(/'/g, "\\'");
      const escapedVersion = String(version).replace(/'/g, "\\'");
      return "(() => { try { " +
        // inject message bridge first (best-effort)
        "try { var b = document.createElement('script'); b.src='" + escapedBridge + "'; (document.head||document.documentElement).appendChild(b); } catch(_) {}" +
        // then inject the agent script
        "window.__DEEPLEARN_ASSISTANT_VERSION__='" + escapedVersion + "';" +
        "var s = document.createElement('script'); s.src='" + escapedUrl + "';" +
        "(document.head||document.documentElement).appendChild(s); return 'ok'; } catch (e) { return 'error:' + e.message; } })();";
    } catch (e) {
      return "(() => 'error:buildExpression')();";
    }
  }

  // Inject agent via script element, with version pre-injected to window
  try {
    const expr = buildInjectionExpression(rule.agent_script);
    const result = await send('Runtime.evaluate', { expression: expr, awaitPromise: false, returnByValue: true });
    const v = result && result.result && result.result.value;
    if (v && String(v).startsWith('error:')) {
      setDebugStatus(tabId, { status: 'error', error: v, rule });
      console.error('[DeepLearn][Debugger] injection error:', v);
    } else {
      setDebugStatus(tabId, { status: 'injected', rule });
      try { Sentry.addBreadcrumb({ category: 'inject', message: 'agent injected', level: 'info', data: { script: rule.agent_script, tabId } }); } catch {}
      console.log('[DeepLearn][Debugger] Injected agent:', rule.agent_script);
    }
  } catch (e) {
    setDebugStatus(tabId, { status: 'error', error: String(e), rule });
    console.error('[DeepLearn][Debugger] inject failed:', e);
  }
}

// Unified, idempotent tab update handler
async function handleTabUpdate(tabId, url) {
  if (!url) return;
  
  // [关键修复] 只处理 http 和 https 协议的页面
  if (!url.startsWith('http:') && !url.startsWith('https:')) {
    console.log(`[DeepLearn] Ignoring non-HTTP(S) URL: ${url}`);
    return; // 立即退出，不进行任何后续操作
  }
  
  // Task 1: update icon
  await updateActionIcon(tabId, url);
  try { Sentry.addBreadcrumb({ category: 'tab', message: 'handleTabUpdate', level: 'info', data: { tabId, url } }); } catch {}

  // Debounce same URL/rule to avoid repeated injection
  const prev = TAB_STATE.get(tabId) || {};
  const rule = await resolveDebuggerRule(url);

  if (!rule) {
    if (ATTACHED_TABS.has(tabId)) await detachDebugger(tabId, 'detached');
    TAB_STATE.set(tabId, { lastUrl: url, lastRulePattern: null });
    CDP_SENT_ON_TAB.set(tabId, false);
    return;
  }

  const sameUrl = prev.lastUrl === url;
  const sameRule = prev.lastRulePattern === rule.url_pattern;
  if (sameUrl && sameRule && ATTACHED_TABS.has(tabId)) {
    // Already attached for same rule and URL; no-op
    return;
  }

  await attachDebuggerAndInject(tabId, url, rule);
  TAB_STATE.set(tabId, { lastUrl: url, lastRulePattern: rule.url_pattern });
  // Reset CDP first-send flag on navigation/rule change
  CDP_SENT_ON_TAB.set(tabId, false);
}

async function initializeAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t?.id && t?.url) {
        await updateActionIcon(t.id, t.url);
        await handleTabUpdate(t.id, t.url);
      }
    }
  } catch (e) {
    console.error('[DeepLearn] init tabs failed:', e);
  }
}

// Events: unified listeners
chrome.runtime.onInstalled.addListener(() => {
  console.log('[DeepLearn] installed');
  setTimeout(initializeAllTabs, 100);
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[DeepLearn] startup');
  setTimeout(initializeAllTabs, 100);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab && tab.url) await handleTabUpdate(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url) await updateActionIcon(activeInfo.tabId, tab.url);
  } catch (e) {
    console.warn('[DeepLearn] onActivated error:', e);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await detachDebugger(tabId, 'detached');
  DEBUG_STATUS.delete(tabId);
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source && source.tabId) {
    ATTACHED_TABS.delete(source.tabId);
    ATTACHING_TABS.delete(source.tabId);
    setDebugStatus(source.tabId, { status: 'detached', error: reason });
    TAB_STATE.delete(source.tabId);
  }
});

// ---- CDP fallback interception for exam paper API ----
const EXAM_API_PATTERN = '/lituoExamPaper/userPaper/test/';

function urlLooksLikeExamApi(url) {
  if (!url) return false;
  try { url = String(url); } catch {}
  if (url.includes(EXAM_API_PATTERN)) return true;
  if (url.includes('/userPaper/test')) return true;
  return /\/userPaper\/.*(test|paper|exam)/i.test(url);
}

// [最终版本] 精确、高效的题目数组提取函数
function findQuestionsArray(obj) {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  // 优先策略：直接检查 obj.data.questions 是否存在且为有效数组
  if (obj.data && Array.isArray(obj.data.questions) && obj.data.questions.length > 0) {
    console.log('[深学助手][CDP] 已从 obj.data.questions 精确提取题目列表。');
    return obj.data.questions;
  }

  // 备用策略：如果顶层直接就是 data 对象，检查其下的 questions
  if (Array.isArray(obj.questions) && obj.questions.length > 0) {
    console.log('[深学助手][CDP] 已从 obj.questions 提取题目列表。');
    return obj.questions;
  }

  // 最后手段：如果以上都不匹配，返回null
  console.warn('[深学助手][CDP] 未能在API响应中找到预期的 "data.questions" 结构。');
  return null;
}

async function handleNetworkResponse(source, method, params) {
  try {
    if (!source || !source.tabId) return;
    if (method !== 'Network.responseReceived') return;
    const tabId = source.tabId;
    const url = params?.response?.url || '';
    if (!urlLooksLikeExamApi(url)) return;
    // If content already has usable answers, avoid further sends per tab
    if (CDP_SENT_ON_TAB.get(tabId) === true) return;

    // Debounce per request
    const seen = CDP_REPORTED.get(tabId) || new Set();
    if (seen.has(params.requestId) || seen.has(url)) return;

    const result = await chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', { requestId: params.requestId }).catch(() => null);
    if (!result) return;
    let bodyText = result.base64Encoded ? atob(result.body || '') : (result.body || '');
    if (!bodyText) return;

    let payload = null;
    try {
      const parsed = JSON.parse(bodyText);
      const questions = findQuestionsArray(parsed);
      if (questions && Array.isArray(questions) && questions.length) {
        payload = { type: 'EXAM_PAPER_RECEIVED', payload: { url, questionsCount: questions.length, questions, raw: parsed }, source: 'deeplearn-exam-agent' };
      } else {
        payload = { type: 'EXAM_PAPER_RAW', payload: { url, raw: parsed }, source: 'deeplearn-exam-agent' };
      }
    } catch (e) {
      // ignore parse error
    }

    if (payload) {
      try { Sentry.addBreadcrumb({ category: 'cdp', message: 'exam paper intercepted', level: 'info', data: { tabId, url } }); } catch {}
      chrome.tabs.sendMessage(tabId, payload, () => {});
      seen.add(params.requestId);
      seen.add(url);
      CDP_REPORTED.set(tabId, seen);
      CDP_SENT_ON_TAB.set(tabId, true);
    }
  } catch (e) {
    console.warn('[DeepLearn][CDP] handleNetworkResponse error:', e);
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  // Observe interesting events; add CDP fallback for exam API
  handleNetworkResponse(source, method, params);
});

//

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      

      if (message?.action === 'getPlatformDefinitions') {
        // 将 PLATFORM_DEFINITIONS 对象的值转换为数组，因为调用方期望数组格式
        sendResponse(Object.values(PLATFORM_DEFINITIONS));
      } else if (message?.action === 'verifyToken') {
        // 处理内容脚本的token验证请求
        const API_BASE_URL = 'https://sxapi.izlx.de/api';
        try {
          const response = await fetch(`${API_BASE_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: message.token })
          });
          const verification = await response.json();
          sendResponse(verification);
        } catch (error) {
          console.error('[DeepLearn Background] API verification failed:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      } else if (message?.action === 'proxyFetch') {
        // 为popup.js新增的fetch代理
        const API_BASE_URL = 'https://sxapi.izlx.de/api';
        try {
          const response = await fetch(`${API_BASE_URL}/${message.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message.data)
          });
          const resultData = await response.json();
          // 将完整的API响应数据包装后发回
          sendResponse({ success: true, data: resultData });
        } catch (error) {
          console.error(`[DeepLearn Background] API Proxy Fetch [${message.endpoint}] failed:`, error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      } else if (message?.action === 'updateIcon') {
        const { tabId } = message;
        if (tabId) {
          const tab = await chrome.tabs.get(tabId);
          await updateActionIcon(tabId, tab?.url);
        }
        sendResponse({ ok: true });
      } else if (message?.action === 'getDebugStatus') {
        const s = DEBUG_STATUS.get(message.tabId) || { status: 'unknown' };
        sendResponse(s);
      } else if (message?.action === 'reportError') {
        // Allow other scripts to forward errors to Sentry
        const { name, message: msg, stack, extra } = message || {};
        const err = new Error(msg || name || 'ReportedError');
        if (stack) err.stack = stack;
        try {
          const pageUrl = sender?.url || sender?.tab?.url;
          const domain = extractDomain(pageUrl);
          const platform = domain ? getPlatformByDomain(domain) : null;

          Sentry.withScope(async (scope) => {
            // 基本标签
            scope.setTag('domain', domain || 'unknown');
            if (platform?.id) scope.setTag('platform_id', platform.id);
            scope.setTag('component', extra?.module || 'unknown');

            // 页面信息上下文
            scope.setContext('page_info', {
              url: pageUrl,
              domain,
              platform_name: platform?.name || 'unknown',
              user_agent: sender?.userAgent || 'unknown'
            });

            // 尝试获取用户标识（非敏感信息）
            try {
              const userData = await getUserIdentificationForSentry();
              if (userData) {
                scope.setUser({
                  id: userData.anonymousId, // 匿名化的用户ID
                  username: userData.platformUser || 'anonymous'
                });
                scope.setContext('user_info', {
                  install_date: userData.installDate,
                  session_count: userData.sessionCount,
                  enabled_platforms: userData.enabledPlatforms?.length || 0
                });
              }
            } catch (userErr) {
              // 获取用户信息失败不应该影响错误上报
              console.warn('[DeepLearn] 获取用户信息失败:', userErr);
            }

            scope.setExtras({
              senderUrl: pageUrl,
              senderId: sender?.tab?.id,
              ...(extra || {})
            });

            Sentry.captureException(err);
          });
        } catch (e) {
          // Non-fatal if Sentry not initialized
          console.warn('[DeepLearn][Sentry] capture failed:', e);
        }
        sendResponse({ ok: true });
      } else if (message?.action === 'addBreadcrumb') {
        const b = (message && message.breadcrumb) || {};
        try { Sentry.addBreadcrumb({ category: b.category || 'app', message: b.message || 'breadcrumb', level: b.level || 'info', data: b.data || {} }); } catch {}
        sendResponse({ ok: true });
      } else if (message?.action === 'setTag') {
        try { if (message.key) Sentry.setTag(message.key, message.value); } catch {}
        sendResponse({ ok: true });
      } else if (message?.action === 'setContext') {
        try { if (message.key) Sentry.setContext(message.key, message.context || {}); } catch {}
        sendResponse({ ok: true });
      }
    } catch (e) {
      console.error('[DeepLearn] message error:', e);
      try { Sentry.captureException(e); } catch {}
      sendResponse({ error: String(e) });
    }
  })();
  return true; // async
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[STORAGE_KEY]) {
    console.log('[DeepLearn] site config changed -> refresh icons and debugger');
    initializeAllTabs().catch(console.error);
  }
});

