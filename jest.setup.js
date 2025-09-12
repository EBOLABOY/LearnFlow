// Polyfill innerText for jsdom
if (!Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'innerText')) {
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() { return this.textContent; },
    set(v) { this.textContent = v; },
  });
}

// Minimal global setup
beforeAll(() => {
  // Namespace scaffold for modules attaching to window.DeepLearn
  window.DeepLearn = window.DeepLearn || {};
  window.DeepLearn.util = window.DeepLearn.util || {};
  window.DeepLearn.sites = window.DeepLearn.sites || {};
  window.DeepLearn.sites.tt0755 = window.DeepLearn.sites.tt0755 || {};
});
