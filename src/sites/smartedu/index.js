// SmartEdu Index - entry and router (UTF-8 clean)
(() => {
  const ns = (window.DeepLearn ||= {});
  const registry = ns.registry;
  const siteNS = (ns.sites ||= {});
  const smartedu = (siteNS.smartedu ||= {});

  const smartEduSite = {
    id: 'smartedu',
    name: '国家智慧教育平台',
    matches(loc) {
      const hosts = ['www.smartedu.cn', 'basic.smartedu.cn', 'smartedu.gdtextbook.com', 'teacher.ykt.eduyun.cn'];
      return hosts.includes(loc.hostname);
    },
    init() {
      const href = location.href;
      console.log('[DeepLearn] SmartEdu page detected:', href);
      if (this.shouldActivateAutomation(href)) {
        console.log('[DeepLearn] Start SmartEdu automation module');
        try { (ns.util && ns.util.breadcrumb) && ns.util.breadcrumb('index', 'mode:automation', 'info', { url: href }); } catch {}
        if (smartedu.initAutomation) {
          setTimeout(() => {
            try { smartedu.initAutomation(); }
            catch (e) { try { (ns.util && ns.util.reportError) && ns.util.reportError(e, { module: 'smartedu.index', where: 'initAutomation' }); } catch {} }
          }, 2000); // ensure fully loaded
        } else {
          console.warn('[DeepLearn] SmartEdu automation module not loaded');
        }
      } else {
        console.log('[DeepLearn] Page does not require automation');
      }
    },
    shouldActivateAutomation(href) {
      return (
        href.includes('/teacherTraining/courseDetail') ||
        href.includes('/study/') ||
        href.includes('/video/') ||
        href.includes('/exam/') ||
        href.includes('/training/')
      );
    }
  };

  if (registry && typeof registry.register === 'function') {
    registry.register(smartEduSite);
    console.log('[DeepLearn] SmartEdu module registered');
  } else {
    console.error('[DeepLearn] Registry not initialized; cannot register SmartEdu module');
  }
})();

