// injected/agents/exam-agent.js

(function() {
  'use strict';
  const DL = (window.DeepLearn) || {};
  const CONSTS = (DL && DL.consts) || {};
  const siteCfg = (DL && DL.sites && DL.sites.tt0755 && DL.sites.tt0755.examConfig) || {};
  const AGENT_ID = CONSTS.AGENT_ID || 'deeplearn-exam-agent';
  const ORIGIN = window.location.origin;
  
  // 防止重复注入
  if (window.__DEEPL_EXAM_AGENT_ACTIVE__) {
    console.log('[深学助手][ExamAgent] 已激活，跳过重复注入');
    return;
  }
  window.__DEEPL_EXAM_AGENT_ACTIVE__ = true;
  console.log('[深学助手][ExamAgent] 注入并初始化...');

  // 统一消息发送
  function postToController(type, payload) {
    try {
      window.postMessage({ source: AGENT_ID, type, payload, timestamp: Date.now() }, ORIGIN);
    } catch (e) {
      console.error('[深学助手][ExamAgent] postMessage 失败:', e);
    }
  }

  // --- 新增：用于存储和更新请求头的全局变量 ---
  const g_headers = {};

  const AUTH_HEADER_KEYS = (CONSTS.AUTH_HEADER_KEYS && Array.isArray(CONSTS.AUTH_HEADER_KEYS) && CONSTS.AUTH_HEADER_KEYS.map(s => String(s).toLowerCase())) || ['authorization','signcontent','timestamp','rolekey'];
  const PAPER_PATTERNS = (Array.isArray(siteCfg.examApiPatterns) && siteCfg.examApiPatterns.length
    ? siteCfg.examApiPatterns
    : (Array.isArray(CONSTS.EXAM_PAPER_PATTERNS) && CONSTS.EXAM_PAPER_PATTERNS.length
        ? CONSTS.EXAM_PAPER_PATTERNS
        : ['/lituoExamPaper/userPaper/test/','/userPaper/test/']));
  const SUBMIT_PATH = (siteCfg.api && siteCfg.api.submitPath) || CONSTS.EXAM_SUBMIT_PATH || '/prod-api/portal/lituoExamPaper/submit';

  function findQuestionsArray(obj) {
    if (!obj || typeof obj !== 'object') return null;
    try {
      if (obj.data && Array.isArray(obj.data.questions) && obj.data.questions.length) return obj.data.questions;
      if (Array.isArray(obj.questions) && obj.questions.length) return obj.questions;
    } catch {}
    return null;
  }

  function tryParseAndReport(url, bodyText) {
    if (!bodyText) return;
    try {
      const parsed = JSON.parse(bodyText);
      const questions = findQuestionsArray(parsed);
      if (questions && Array.isArray(questions)) {
        // 成功解析到题目和答案
        postToController('EXAM_PAPER_RECEIVED', { url, questionsCount: questions.length, questions, raw: parsed });
      } else {
        // 可能是其他API响应，也发给控制器
        postToController('EXAM_PAPER_RAW', { url, raw: parsed });
      }
    } catch (e) {
      // JSON解析失败，忽略
    }
  }

  // 劫持 XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__dl_url = url;
    return origOpen.apply(this, arguments);
  };

  // --- 新增：劫持 setRequestHeader 以保存关键信息 ---
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    const headerLower = header.toLowerCase();
    if (AUTH_HEADER_KEYS.includes(headerLower)) {
        g_headers[header] = value;
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this.status >= 200 && this.status < 300) {
        if (this.__dl_url && PAPER_PATTERNS.some(p => String(this.__dl_url).includes(p))) {
          tryParseAndReport(this.__dl_url, this.responseText);
        }
      }
    });
    return origSend.apply(this, arguments);
  };

  // 劫持 fetch API
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function(...args) {
      const request = new Request(...args);
      // --- 新增：从 fetch 请求中保存关键头信息 ---
      for (const [key, value] of request.headers.entries()) {
        const keyLower = key.toLowerCase();
        if (AUTH_HEADER_KEYS.includes(keyLower)) {
            g_headers[key] = value;
        }
      }
      
      const promise = origFetch(...args);
      if (request.url && PAPER_PATTERNS.some(p => String(request.url).includes(p))) {
        promise.then(response => {
          if (response.ok) {
            response.clone().text().then(text => tryParseAndReport(request.url, text));
          }
        });
      }
      return promise;
    };
  }

  // --- 新增：监听来自 Controller 的提交命令 ---
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || event.data.target !== AGENT_ID) return;
    
    const { command, payload } = event.data;

    if (command === 'SUBMIT_ANSWERS') {
      console.log('[深学助手][ExamAgent] 收到提交命令, 负载:', payload);
      const submitUrl = SUBMIT_PATH;
      
      // 准备请求头
      const headers = new Headers(g_headers);
      headers.set('Content-Type', 'application/json;charset=UTF-8');

      try {
        const response = await fetch(submitUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok && result.code === 200) {
          console.log('[深学助手][ExamAgent] 答案提交成功:', result);
          postToController('SUBMIT_SUCCESS', result);
        } else {
          console.error('[深学助手][ExamAgent] 答案提交失败:', result);
          postToController('SUBMIT_ERROR', result.msg || '提交失败');
        }
      } catch (error) {
        console.error('[深学助手][ExamAgent] 提交请求时发生网络错误:', error);
        postToController('SUBMIT_ERROR', error.message);
      }
    }
  });

  // 握手: 标记Agent已就绪并通知Controller
  window.__DEEPL_EXAM_AGENT_READY__ = true;
  postToController('AGENT_READY', { href: location.href });
  console.log('[深学助手][ExamAgent] 已成功注入并开始监听网络请求。');

})();
