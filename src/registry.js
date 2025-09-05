(() => {
  const ns = (window.DeepLearn ||= {});

  // Registry for site modules. Each site should expose: id, name, matches(location), init()
  const registry = (ns.registry ||= {
    sites: [],
    register(site) { this.sites.push(site); },
    resolve(loc = window.location) { return this.sites.find(s => s.matches(loc)); }
  });

  // placeholder: sites will self-register when their files are loaded.
})();

