// 0755TT Exam Agent – runs in page main world
// Goal: intercept exam paper API response and forward questions to controller

(function() {
  'use strict';

  const AGENT_ID = 'deeplearn-exam-agent';
  const ORIGIN = window.location.origin;
  let hookXHROk = false;
  let hookFetchOk = false;

  if (window.__DEEPL_EXAM_AGENT_ACTIVE__) {
    try { console.log('[深学助手][ExamAgent] already active; skip reinject'); } catch {}
    return;
  }
  window.__DEEPL_EXAM_AGENT_ACTIVE__ = true;
  try { console.log('[深学助手][ExamAgent] injected and initializing...'); } catch {}

  function postToController(type, payload) {
    try {
      const b = window.__DEEPL_MESSAGE_BRIDGE__;
      if (b && typeof b.post === 'function') {
        b.post(type, payload, AGENT_ID);
      } else {
        window.postMessage({ source: AGENT_ID, type, payload, timestamp: Date.now() }, ORIGIN);
      }
    } catch {}
  }

  // Use robust pattern captured from real traffic
  const EXAM_API_PATTERN = '/lituoExamPaper/userPaper/test/';

  function urlLooksLikeExamApi(url) {
    if (!url) return false;
    try { url = String(url); } catch {}
    // Prefer precise pattern; tolerate variable prefixes like /prod-api/portal
    if (url.includes(EXAM_API_PATTERN)) return true;
    // Fallbacks: more general but scoped to userPaper
    if (url.includes('/userPaper/test')) return true;
    return /\/userPaper\/.*(test|paper|exam)/i.test(url);
  }

  function findQuestionsArray(obj, depth = 0) {
    if (!obj || depth > 5) return null;
    if (Array.isArray(obj)) return obj; // already an array, assume it's the list
    if (typeof obj !== 'object') return null;
    // Prefer explicit keys
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      const k = key.toLowerCase();
      if ((k === 'questions' || k === 'questionlist' || k === 'subjects' || k === 'items') && Array.isArray(v)) {
        return v;
      }
    }
    // Otherwise DFS into children
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      const found = findQuestionsArray(v, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function tryParseAndReport(url, bodyText) {
    if (!bodyText) return;
    try {
      const parsed = JSON.parse(bodyText);
      const questions = findQuestionsArray(parsed);
      if (questions && Array.isArray(questions) && questions.length) {
        postToController('EXAM_PAPER_RECEIVED', { url, questionsCount: questions.length, questions, raw: parsed });
      } else {
        // Still report raw for debugging; controller can decide
        postToController('EXAM_PAPER_RAW', { url, raw: parsed });
      }
    } catch (e) {
      // Not JSON or parse failed; ignore silently
    }
  }

  // Patch XMLHttpRequest
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      try { this.__dl_url = url; } catch {}
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      try {
        this.addEventListener('load', function() {
          try {
            const url = this.__dl_url || '';
            if (!urlLooksLikeExamApi(url)) return;
            if (!(this.status >= 200 && this.status < 300)) return;
            let text = '';
            try {
              if (this.responseType === 'json' && this.response) text = JSON.stringify(this.response);
              else text = this.responseText || '';
            } catch {}
            tryParseAndReport(url, text);
          } catch {}
        });
      } catch {}
      return origSend.apply(this, arguments);
    };
    hookXHROk = true;
  } catch (e) {
    try { console.warn('[ExamAgent] XHR patch failed:', e); } catch {}
  }

  // Patch fetch
  try {
    const origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function() {
        const args = Array.from(arguments);
        let url = '';
        try {
          const req = args[0];
          url = typeof req === 'string' ? req : (req && req.url) || '';
        } catch {}
        const p = origFetch.apply(this, args);
        try {
          if (urlLooksLikeExamApi(url)) {
            p.then(resp => {
              try {
                const r = resp.clone();
                r.text().then(txt => tryParseAndReport(url, txt)).catch(() => {});
              } catch {}
            }).catch(() => {});
          }
        } catch {}
        return p;
      };
      hookFetchOk = true;
    }
  } catch (e) {
    try { console.warn('[ExamAgent] fetch patch failed:', e); } catch {}
  }

  // Handshake: mark ready and notify controller
  try {
    window.__DEEPL_EXAM_AGENT_READY__ = true;
    postToController('AGENT_READY', { xhr: hookXHROk, fetch: hookFetchOk, href: location.href });
  } catch {}

  // Heartbeat
  try {
    console.log(`[ExamAgent] Active. Watching pattern: "${EXAM_API_PATTERN}"`);
    setInterval(() => {
      postToController('HEARTBEAT', { t: Date.now() });
    }, 15000);
  } catch {}
})();
