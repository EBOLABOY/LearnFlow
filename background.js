// DeepLearn Assistant - Background (MV3, ESM)
// - Dynamic action icon + title
// - Config-driven Debugger/CDP attach + agent injection
// - Popup messaging for platform definitions and debugger status

import { PLATFORM_DEFINITIONS, getPlatformByDomain } from './src/platforms.js';

const STORAGE_KEY = 'enabledSites';
const CDP_VERSION = '1.3';

// Debugger + status state
const ATTACHED_TABS = new Set();         // Set<number>
const ATTACHING_TABS = new Set();        // Set<number> (reentry guard)
const DEBUG_STATUS = new Map();          // tabId -> { status, rule, error, ts }
const TAB_STATE = new Map();             // tabId -> { lastUrl, lastRulePattern }

const ICONS = {
  enabled: { '16': 'icon16.png', '48': 'icon48.png', '128': 'icon128.png' },
  // 使用一套灰度图标文件（当前为占位文件，可替换为真正灰度版本）
  disabled: { '16': 'icon16_disabled.png', '48': 'icon48_disabled.png', '128': 'icon128_disabled.png' }
};

function extractDomain(url) {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return null; }
}
function isSupported(domain) { return !!getPlatformByDomain(domain); }

function getSiteConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: {} }, (data) => resolve(data[STORAGE_KEY] || {}));
  });
}

function setDebugStatus(tabId, patch) {
  const prev = DEBUG_STATUS.get(tabId) || {};
  const next = { ...prev, ...patch, ts: Date.now() };
  DEBUG_STATUS.set(tabId, next);
}

async function updateActionIcon(tabId, url, config = null) {
  const domain = extractDomain(url);
  const supported = isSupported(domain);
  const cfg = config || await getSiteConfig();
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
  const cfg = await getSiteConfig();
  if (cfg[domain] === false) return null; // disabled explicitly
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
  } catch (e) {
    console.warn('[DeepLearn][Debugger] enable domains failed:', e);
  }

  // Inject agent via script element
  try {
    const scriptUrl = chrome.runtime.getURL(rule.agent_script);
    const expr = `(() => { try { var s = document.createElement('script'); s.src = '${scriptUrl.replace(/'/g, "\\'")}'; (document.head||document.documentElement).appendChild(s); return 'ok'; } catch (e) { return 'error:' + e.message; } })();`;
    const result = await send('Runtime.evaluate', { expression: expr, awaitPromise: false, returnByValue: true });
    const v = result && result.result && result.result.value;
    if (v && String(v).startsWith('error:')) {
      setDebugStatus(tabId, { status: 'error', error: v, rule });
      console.error('[DeepLearn][Debugger] injection error:', v);
    } else {
      setDebugStatus(tabId, { status: 'injected', rule });
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
  // Task 1: update icon
  await updateActionIcon(tabId, url);

  // Debounce same URL/rule to avoid repeated injection
  const prev = TAB_STATE.get(tabId) || {};
  const rule = await resolveDebuggerRule(url);

  if (!rule) {
    if (ATTACHED_TABS.has(tabId)) await detachDebugger(tabId, 'detached');
    TAB_STATE.set(tabId, { lastUrl: url, lastRulePattern: null });
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
}

async function initializeAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const cfg = await getSiteConfig();
    for (const t of tabs) {
      if (t?.id && t?.url) {
        await updateActionIcon(t.id, t.url, cfg);
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

chrome.debugger.onEvent.addListener((source, method, params) => {
  // Optional: observe interesting events
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.action === 'getPlatformDefinitions') {
        sendResponse(PLATFORM_DEFINITIONS);
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
      }
    } catch (e) {
      console.error('[DeepLearn] message error:', e);
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

