// SmartEdu Automation - 鑷姩鍖栨祦绋嬫帶鍒讹紙UTF-8 娓呮磥鐗堬級
// 璐熻矗 DOM 鎿嶄綔銆侀〉闈㈤€昏緫鍒ゆ柇鍜屾祦绋嬫帶鍒?
(() => {
  'use strict';

  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const smartedu = (siteNS.smartedu ||= {});
  const util = ns.util || {};
  // 闁稿繈鍔岄惇顒勬焻濮樿京鍙€濞寸媴绲块幃濠囨晬濮樿京鍩犲☉鎾亾閻?util.showMessage
  const showMessage = (...args) => {
    try { return util && typeof util.showMessage === 'function' ? util.showMessage(...args) : null; } catch (_) { return null; }
  };

  // 闂佹寧鐟ㄩ銈嗙▔婵犲啫袚闁告柡鏅滄晶?
  function report(err, extra = {}) {
    try {
      if (util && typeof util.reportError === 'function') {
        util.reportError(err, { module: 'smartedu.automation', ...extra });
      } else {
        chrome.runtime?.sendMessage && chrome.runtime.sendMessage({ action: 'reportError', name: err?.name, message: err?.message || String(err), stack: err?.stack, extra: { module: 'smartedu.automation', ...extra } }, () => {});
      }
    } catch (_) {}
  }

  // 濮掓稒顭堥濠氭煀瀹ュ洨鏋傞柨娑樼墔缁姷绱掗悢鍓侇伇闁轰胶澧楀畵浣糕攦閹邦垰绠柛娆愮壄缁辨繄鏁敃鈧悾銊╁礂閵娿儲绀€闂侇偀鍋撻柨?
  const smarteduConfig = siteNS.smartedu || {};
  const PLATFORM = smarteduConfig.PLATFORM_CONFIG || {};
  const DEFAULT_CONFIG = {
    courseName: PLATFORM.courseName || '閻犲洤澧介埢濂告⒖?,
    homeUrl: PLATFORM.homeUrl || location.origin,
    courseUrls: (typeof smarteduConfig.getCourseUrls === 'function' ? smarteduConfig.getCourseUrls() : []),
    lessons: (typeof smarteduConfig.getDefaultLessons === 'function' ? smarteduConfig.getDefaultLessons() : []),
    watchInterval: PLATFORM.watchInterval || 10000,
    autoNext: PLATFORM.autoNext !== false
  };

  let config = { ...DEFAULT_CONFIG };
  let isRunning = false;
  let watchTimer = null;
  let tick = 0;
  let pageNumber = null;
  let pageCount = null;

  // Agent 闁圭儵鍓濇晶婊堟偐閼哥鍋撴担渚悁闁?
  let agentReady = false;
  let pendingAgentCommands = [];
  const AGENT_READY_TIMEOUT = 10000; // 10缂佸甯熺粔鎾籍?

  // 婵炲鍔岄崣?Agent 闁煎瓨纰嶅﹢浼寸嵁閸撲胶鎼肩€垫澘鎳忚ぐ娆撳箥?
  function injectAgent() {
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/sites/smartedu/agent.js');
        (document.head || document.documentElement).appendChild(script);
        script.onload = () => {
          script.remove();
          // 缂佹稑顦欢鐔煎箵閳╁啫顤佸ǎ鍥ｂ偓鍐插▏
          const timeout = setTimeout(() => {
            console.warn('[婵烇絽宕鐔煎礉閳哄倸顤乚 Agent 闁圭儵鍓濇晶婊呮惥閸涱喗顦ч柨娑樼灱閹撮绱掗鐔封挃閻炴稑濂旂徊楣冨礉閻旇鍘撮柛娆樺灥閸忔﹢宕ｅΔ鍛€?);
            agentReady = false;
            resolve(false);
          }, AGENT_READY_TIMEOUT);
          const onReady = (event) => {
            if (event.source === window && event.origin === window.location.origin && event.data && event.data.target === 'deeplearn-smartedu-controller' && event.data.command === 'AGENT_READY') {
              clearTimeout(timeout);
              window.removeEventListener('message', onReady);
              agentReady = true;
              console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 Agent 闁圭儵鍓濇晶婊堝箣閹邦剙顫犻柨娑楁祰閸忔﹢宕? ', event.data.payload && event.data.payload.capabilities);
              processPendingAgentCommands();
              resolve(true);
            }
          };
          window.addEventListener('message', onReady);
        };
        script.onerror = () => {
          const err = new Error('Agent script injection failed');
          console.error('[婵烇絽宕鐔煎礉閳哄倸顤乚 Agent 闁煎瓨纰嶅﹢鏉库枖閵娿儱寮冲鎯扮簿鐟?);
          try { report(err, { where: 'injectAgent' }); } catch {}
          reject(err);
        };
      } catch (e) {
        try { report(e, { where: 'injectAgent.try' }); } catch {}
        reject(e);
      }
    });
  }

  // 闁告梻濮惧ù?闁告艾鐗嗛懟鐔兼偨閵婏箑鐓曢梺鏉跨Ф閻?
  function loadConfig() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get('smartEduConfig', (data) => {
          if (data && data.smartEduConfig) {
            const u = data.smartEduConfig;
            config = { ...DEFAULT_CONFIG, ...u };
            if (Array.isArray(u.lessons)) config.lessons = u.lessons;
            if (typeof u.courseUrl === 'string') config.customCourseUrl = u.courseUrl;
            if (typeof u.watchInterval === 'number') config.watchInterval = u.watchInterval;
          }
          resolve();
        });
      } catch (_) { resolve(); }
    });
  }

  // 缂佹梹鐟ч崑锝咁嚕閳ь剟宕楅搹顐⒕闁?
  function checkAutoMode() {
    chrome.storage.sync.get('enabledSites', (data) => {
      const enabledSites = data.enabledSites || {};
      const domain = location.hostname;
      const enabled = enabledSites[domain] !== false; // 濮掓稒顭堥濠氬触椤栨粍鏆?
      if (enabled) {
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁煎浜滄慨鈺佄熼垾宕囩鐎瑰憡褰冮幆搴ㄦ偨椤帞绀? 缂佸甯掗幃妤呭触椤栨艾袟...');
        setTimeout(() => { try { startMainLogic(); } catch (e) { report(e, { where: 'startMainLogic' }); } }, 2000);
      } else {
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁煎浜滄慨鈺佄熼垾宕囩闁哄牜浜滈幆搴ㄦ偨閵婏箑鐏楃紒鏃€鐟ч崑锝囨偖椤愩値娲ｉ柣?);
      }
    });
  }

  // Agent 婵炴垵鐗婃导?
  function sendCommandToAgent(command, payload = null) {
    const msg = { target: 'deeplearn-smartedu-agent', command, payload, timestamp: Date.now() };
    if (agentReady) {
      window.postMessage(msg, window.location.origin);
    } else {
      pendingAgentCommands.push(msg);
    }
  }
  function processPendingAgentCommands() {
    if (pendingAgentCommands.length) {
      pendingAgentCommands.forEach((m) => window.postMessage(m, window.location.origin));
      pendingAgentCommands = [];
    }
  }
  function handleAgentMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin || !event.data || event.data.target !== 'deeplearn-smartedu-controller') return;
    const { command, payload } = event.data;
    console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 Controller 闁衡偓鐠哄搫鐓?Agent 婵炴垵鐗婃导?', command, payload);
    switch (command) {
      case 'AGENT_READY':
        // 鐎瑰憡褰冨﹢顏勨枖閵娿儱寮抽柡鍐硾椤︹晠鎮?
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 Agent 闁绘鍩栭埀顑胯兌閳ユ鎷嬮妶蹇曠獥鐎瑰憡褰冨銊х磼?);
        break;
      case 'USER_ID_RESPONSE':
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁活潿鍔嶉崺姹璂:', payload);
        break;
      case 'FULLS_JSON_RESPONSE':
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 閻犲洤澧介埢濂稿极閻楀牆绁?', payload);
        break;
      case 'FAKE_XHR_COMPLETED':
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 缂佸甯熺换鍐箼瀹ュ嫮绋婇悗鐟版湰閸?', payload);
        showMessage('✅ 秒过操作完成', 3000);
        break;
      case 'FAKE_XHR_ERROR':
        console.warn('[婵烇絽宕鐔煎礉閳哄倸顤乚 缂佸甯熺换鍐箼瀹ュ嫮绋婂鎯扮簿鐟?', payload);
        showMessage('❌ 秒过操作失败: ' + payload, 5000);
        break;
      default:
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁哄牜浜滈ˇ鈺呮偠閸℃瑦鐣?Agent 婵炴垵鐗婃导?', command, payload);
    }
  }

  // PDF 婵炴垵鐗婃导?
  function handlePDFMessage(event) {
    if (!event.data) return;
    const data = event.data;
    if (data.type === 'pdfPlayerInitPage') {
      pageNumber = data.data.pageNumber;
      pageCount = data.data.pageCount;
      console.log(`[婵烇絽宕鐔煎礉閳哄倸顤乚 PDF闁哄倸娲﹂妴鍌炲礆濠靛棭娼楅柛? pageNumber=>${pageNumber}, pageCount=>${pageCount}`);
    }
  }

  // 缂佺姭鍋撴繛韫窔閳ь剚姘ㄩ悡锛勫寲閼姐倗鍩犻柨娑樻汞hadow DOM闁?


  // 濞戞挸顭烽埀顒佹缁?
  function startMainLogic() {
    console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐎殿喒鍋撳┑顔碱儎鐎靛矂鏌呴弰蹇曞竼...');
    const href = location.href;
    console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐟滅増鎸告晶鐘炽亜閻㈠憡妗?', href);
    if (config.courseUrls && config.courseUrls.includes(href)) {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 婵☆偀鍋撴繛鏉戭儏閸╁瞼鎷犻崜褉鏌ゅ銈囨暬濞间即鏁嶇仦鐣岀；濠殿喖顑呴崺娑氭嫚閻愵剛銈︾紒?);
      showMessage('📚 开始自动学习课程...', 5000);
      startWatching();
    } else if (href.includes('https://smartedu.gdtextbook.com/education/')) {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 妤犵偛銇樼粭銏ゆ偋绾懎顥忛柡浣圭懆閸嬫盯鐛崘鎻掗叡 iframe 濠㈣泛瀚幃?);
    } else if (href.includes('https://teacher.ykt.eduyun.cn/pdfjs/')) {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 PDF 濡炪倗鏁诲鐗堝緞閸曨厽鍊?);
      startPDFReading();
    } else {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 濞戞挸顭烽妴澶愭椤喚绀夐柡鍕⒔閵囨岸鏌呮径瀣仴闁兼寧绮屽畷?);
      showMainMenu();
    }
  }

  function showMainMenu() {
    const menuHtml = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 10000; padding: 24px; min-width: 400px; font-family: system-ui;">
        <h2 style="margin: 0 0 20px; text-align: center; color: #333;">娣卞鍔╂墜 - 鏅烘収鏁欒偛骞冲彴</h2>
        <p style="text-align: center; color: #666; margin-bottom: 24px;">閫夋嫨鎮ㄨ鎵ц鐨勬搷浣滐細</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button id="smartedu-start-courses" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            🚀 开始刷配置的课程<br><small style="opacity: 0.8;">${config.courseName}</small>

</small>
          </button>
          <button id="smartedu-current-page" style="padding: 12px 24px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            馃摉 鍙埛褰撳墠椤电殑瑙嗛
          </button>
          <button id="smartedu-close-menu" style="padding: 12px 24px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            ❌ 关闭
          </button>
        </div>
      </div>
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" id="smartedu-menu-overlay"></div>
    `
    const container = document.createElement('div');
    container.innerHTML = menuHtml;
    document.body.appendChild(container);
    document.getElementById('smartedu-start-courses').onclick = () => { container.remove(); showMessage('🚀 开始刷课程...', 3000); nextCourse(); };
    document.getElementById('smartedu-current-page').onclick = () => { container.remove(); showMessage('📖 开始当前页面学习...', 3000); startWatching(); };
    document.getElementById('smartedu-close-menu').onclick = () => container.remove();
    document.getElementById('smartedu-menu-overlay').onclick = () => container.remove();
  }

  function nextCourse() {
    const href = location.href;
    const index = (config.courseUrls || []).indexOf(href);
    if (index > -1) {
      if (index + 1 < config.courseUrls.length) {
        console.log(`[婵烇絽宕鐔煎礉閳哄倸顤乚 閻犲搫鐤囧ù鍡涘礆妫颁胶鐟撳☉鎾亾濞戞搩浜ｉ宕囩矙?(${index + 1}/${config.courseUrls.length})`);
        location.href = config.courseUrls[index + 1];
      } else {
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁圭鍋撻柡鍫濐槼椤曞磭绮欑€ｎ亜鍤掗悗鐟版湰閸ㄦ岸鏁嶅畝鍐闁搞儳鍋樼€靛本銇?);
        location.href = config.homeUrl;
      }
    } else {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐎殿喒鍋撳┑顔碱儑椤戝洦绋夐埀顒佺▔椤忓浂鍤︾紒?);
      if (config.courseUrls && config.courseUrls[0]) location.href = config.courseUrls[0];
    }
  }

  function startWatching() {
    if (isRunning) { console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁烩晜鍨剁敮璺侯啅閹绘帗韬弶鈺傚姌椤?); return; }
    isRunning = true;
    console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐎殿喒鍋撳┑顔碱儑濞插啴骞掕閹﹪鎮?..');
    const loop = () => {
      try {
        console.log(`[婵烇絽宕鐔煎礉閳哄倸顤乚 tick[${String(++tick).padStart(9, '0')}]`);
        clickNext();
        playVideo();
        readPDF();
        autoAnswer();
      } catch (e) { report(e, { where: 'watch.loop' }); }
    };
    setTimeout(loop, 1000);
    watchTimer = setInterval(loop, config.watchInterval);
  }
  function stopWatching() {
    isRunning = false;
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
    console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁烩晜鍨剁敮璺侯嚗椤忓棗绠氱€瑰憡褰冩禒鐘差潰?);
  }

  function clickNext(autoNext = true) {
    // 閻庢冻闄勫鍌炲礆閵堝棙鐒?
    if (config.lessons) {
      const href = location.href;
      const index = (config.courseUrls || []).indexOf(href);
      const lesson = config.lessons[index];
      if (lesson !== undefined && lesson !== -1) {
        // 閻忕偞娲栫槐鎴﹀箥閳ь剟寮垫径瀣潙闁告瑧濞€閵?
        Array.from(document.getElementsByClassName('fish-collapse-header')).forEach(el => el.click());
        const finished = document.getElementsByClassName('iconfont icon_checkbox_fill');
        console.log(`[婵烇絽宕鐔煎礉閳哄倸顤乚 鐟滅増鎸告晶鐘炽亜閻㈠憡妗ㄧ€瑰憡褰冮鐔衡偓鐟拌閳?{finished.length}闁靛棙鍨抽柌婊呮喆閸℃侗鏆ラ柨娑樿嫰椤掔喖寮幆閭︽矗婵懓鍊风拹鐔煎Υ?{lesson}闁靛棙鍨抽柌婊呮喆閸℃侗鏆ラ柨娑樻湰濡叉悂宕ラ敃浣瑰涧闁哄秴娴勭槐?{finished.length >= lesson}`);
        if (finished.length >= lesson) {
          console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐟滅増鎸告晶鐘垫嫚閸撗€鏌ょ€规瓕灏幓顏堝礆閺夋鍔呴柡鍐╁劶椤╋箑效閸岋妇绀夐悹鍝勭枃濞村棙绋夌€ｂ晝顏卞☉鎿冧海椤曞磭绮?);
          stopWatching();
          nextCourse();
          return;
        }
      }
    }
    let targetIcon = null;
    function findIcon() {
      targetIcon = document.getElementsByClassName('iconfont icon_processing_fill')[0] || document.getElementsByClassName('iconfont icon_checkbox_linear')[0];
    }
    findIcon();
    if (!targetIcon) {
      Array.from(document.getElementsByClassName('fish-collapse-header')).some(h => { h.click(); findIcon(); return !!targetIcon; });
    }
    if (targetIcon) {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁瑰灚鍎抽崺灞剧▔鐎ｂ晝顏卞☉鎿冧海椤锛愰幋顖滅闁绘劗鎳撻崵顕€骞橀鐔告澒');
      targetIcon.click();
    } else if (autoNext && config.autoNext) {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐟滅増鎸告晶鐘炽亜閻㈠憡妗ㄩ柟纰樺亾闁哄牆顦抽～瀣紣閹存繂鍤掗柟缁㈠幗閺備胶鈧懓鐭夌槐婵堟崉鐎圭姵绁☉鎾愁儎缁斿瓨绋夐鍥跺殾缂?);
      stopWatching();
      nextCourse();
    } else {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐟滅増鎸告晶鐘炽亜閻㈠憡妗ㄩ柟纰樺亾闁哄牆顦抽～瀣紣閹存繂鍤掗柟缁㈠幗閺備胶鈧?);
      showMessage('✅ 当前页面所有视频已播放完！', 5000);
    }
  }

  function playVideo(videoElement = null) {
    if (!videoElement) videoElement = document.getElementsByTagName('video')[0];
    if (videoElement) {
      videoElement.muted = true;
      try {
        const p = videoElement.play();
        if (p && typeof p.then === 'function') {
          p.catch(err => console.warn('[婵烇絽宕鐔煎礉閳哄倸顤乚 婵炴潙绻楅～宥夊闯閵娾晜鈻庢慨婵勫灱閸ゆ粓宕濋妸锔藉啊闁衡偓?闂傚洠鍋撻柣顫妽閸╂稒绂嶉妶鍕瀺):', (err && (err.name + ': ' + err.message)) || err));
        }
      } catch (err) {
        console.warn('[婵烇絽宕鐔煎礉閳哄倸顤乚 閻犲鍟伴弫?video.play() 闁告垶妞介弫?', (err && (err.name + ': ' + err.message)) || err);
      }
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 閻熸瑥妫濋。璺侯嚕閳ь剚鎱ㄧ€ｎ偅灏￠柡鈧?);
    }
    const confirmBtn = document.getElementsByClassName('fish-btn fish-btn-primary')[0];
    if (confirmBtn && confirmBtn.innerText.includes('鐭ラ亾')) {
      confirmBtn.click();
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁稿繑濞婂Λ瀵告喆閸℃侗鏆ラ柟缁樺姉閵?);
    }
  }

  function readPDF() {
    if (!pageCount) return;
    console.log(`[婵烇絽宕鐔煎礉閳哄倸顤乚 PDF闁哄倸娲﹂妴鍌炴⒓閸涢偊鍤? pageNumber=>${pageNumber}, pageCount=>${pageCount}`);
    const nextBtn = document.getElementById('next');
    if (nextBtn) nextBtn.click();
    if (pageCount) {
      console.log(`[婵烇絽宕鐔煎礉閳哄倸顤乚 PDF闁哄倸娲﹂妴鍌滄崉閸愭彃鐓傞柡鍫氬亾闁告艾绨肩粩瀛樸亜? ${pageCount}`);
      window.postMessage({ type: 'pdfPlayerPageChangeing', data: { pageNumber: pageCount, pageCount } }, window.location.origin);
      setTimeout(() => {
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 PDF闁哄倸娲﹂妴鍌滄崉閸愭彃鐓傜紒妤婂厸缁斿瓨銇?..');
        window.postMessage({ type: 'pdfPlayerPageChangeing', data: { pageNumber: 1, pageCount } }, window.location.origin);
      }, 1000);
      pageCount = null; // 闂佹彃绉堕悿?
    }
  }

  function startPDFReading() { console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐎殿喒鍋撻柛?PDF 闂傚啫鎳撻鏉课熼垾宕囩'); setInterval(readPDF, config.watchInterval); }

  function autoAnswer() {
    let attempts = 0;
    const maxAttempts = 3;
    const timer = setInterval(() => {
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁煎浜滄慨鈺冪驳閺冨牜鏆俊顐熷亾婵?..');
      const firstOption = document.getElementsByClassName('nqti-check')[0];
      if (firstOption) {
        firstOption.click();
        console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐎瑰憡鐓￠埀顒€顦扮€氥劎绮甸弮鈧、?);
        for (let i = 0; i < 2; i++) {
          const btn = document.querySelector('div.index-module_footer_3r1Yy > button');
          if (btn) { btn.click(); console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 鐎圭寮惰ぐ浣圭閵堝洨鎽曟俊?); }
        }
      }
      attempts++;
      if (attempts >= maxAttempts) clearInterval(timer);
    }, 1000);
  }

  // 闂佹鍠氬ú蹇氱疀椤愶絽绁归梺?
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyG') { showMessage('🚀 执行秒过操作...', 3000); sendCommandToAgent('EXECUTE_FAKE_XHR'); }
      else if (event.code === 'KeyT') { showMessage('🔧 测试功能', 2000); console.log('[深学助手] 测试功能触发'); }
    });
  }

  // 闁哄棙鎸冲﹢鍫曞箳閵夈儱缍?
  smartedu.startWatching = startWatching;
  smartedu.stopWatching = stopWatching;
  smartedu.nextCourse = nextCourse;
  smartedu.isRunning = () => isRunning;
  smartedu.updateConfig = (newConfig) => { config = { ...config, ...newConfig }; chrome.storage.sync.set({ smartEduConfig: config }); };
  smartedu.triggerFakeXHR = () => sendCommandToAgent('EXECUTE_FAKE_XHR');
  smartedu.showMessage = util && util.showMessage;
  smartedu.clearNotifications = () => (util.NotificationManager && util.NotificationManager.clear());
  smartedu.destroyNotifications = () => (util.NotificationManager && util.NotificationManager.destroy());
  smartedu.isAgentReady = () => agentReady;
  smartedu.getPendingCommandCount = () => pendingAgentCommands.length;

  // 闁告帗绻傞～鎰板礌閺嶎剙娈伴柛鏂诲妼鐎垫彃螣閳ヨ櫕鍋?
  smartedu.initAutomation = async function initAutomation() {
    console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 SmartEdu 闁煎浜滄慨鈺呭礌閺嶎煂渚€宕稿Δ鈧崹鍨叏鐎ｎ亜顕у☉?..');
    try {
      const agentOK = await injectAgent();
      if (!agentOK) console.warn('[婵烇絽宕鐔煎礉閳哄倸顤乚 Agent 闁圭儵鍓濇晶婊勫緞鏉堫偉袝闁挎稑鏈悡鍥ㄧ濞戞ê顫犻柤瀹犳瑜版煡鎳楅幋鎺旂憹闁告瑯鍨抽弫?);
      await loadConfig();
      console.log('[婵烇絽宕鐔煎礉閳哄倸顤乚 闂佹澘绉堕悿鍡涘礉閻樼儤绁伴悗鐟版湰閸?', config);
      checkAutoMode();
      window.addEventListener('message', (e) => { try { handleAgentMessage(e); } catch (err) { try { report(err, { where: 'agentMessage' }); } catch {} } });
      window.addEventListener('message', (e) => { try { handlePDFMessage(e); } catch (err) { try { report(err, { where: 'pdfMessage' }); } catch {} } });
      setupKeyboardShortcuts();
    } catch (e) {
      console.error('[婵烇絽宕鐔煎礉閳哄倸顤乚 闁煎浜滄慨鈺呭礌閺嶎煂渚€宕稿Δ鈧崹鍨叏鐎ｎ亜顕у鎯扮簿鐟?', e);
      try { report(e, { where: 'initAutomation' }); } catch {}
      showMessage('模块初始化失败', 5000);
    }
  };

  // 闁告繂绉寸花鎻掝嚕閸︻厾宕堕柡灞诲劥椤曟銇愰幘鍐差枀閺夆晜鍔橀、鎴︽偐閼哥鍋?  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'getStatus') {
        sendResponse({ active: !!isRunning, status: isRunning ? 'running' : 'idle' });
      }
    });
  } catch (_) {}

})();

