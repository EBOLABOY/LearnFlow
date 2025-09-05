(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  const site = {
    id: 'www.0755tt.com',
    name: '0755TT 学习平台',
    matches(loc) {
      return /(^|\.)0755tt\.com$/i.test(loc.hostname);
    },
    init() {
      const href = location.href;
      if (/\/student\/section/.test(href)) {
        console.log('[深学助手] 章节测试模式');
        tt.initExam();
      } else if (/\/video/.test(href)) {
        console.log('[深学助手] 视频播放模式');
        tt.initVideo();
      } else {
        console.log('[深学助手] 当前页面未匹配到具体模式');
      }
    },
  };

  registry.register(site);
})();

