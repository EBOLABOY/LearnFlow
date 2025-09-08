// Polyfill innerText for jsdom
if (!Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'innerText')) {
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() { return this.textContent; },
    set(v) { this.textContent = v; },
  });
}