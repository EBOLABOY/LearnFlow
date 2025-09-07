// Simple message bridge placeholder for injected agents
(function(){
  try {
    if (window.__DEEPL_MESSAGE_BRIDGE__) return;
    window.__DEEPL_MESSAGE_BRIDGE__ = {
      post(type, payload, source = 'deeplearn-bridge') {
        try { window.postMessage({ source, type, payload, timestamp: Date.now() }, window.location.origin); } catch {}
      }
    };
  } catch {}
})();

