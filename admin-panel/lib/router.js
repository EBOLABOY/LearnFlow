// Lightweight router bridge for non-React modules (e.g., axios interceptors)
// Stores a reference to Next.js router set from _app.js
let _router = null;

export function setRouter(router) {
  _router = router;
}

export function getRouter() {
  return _router;
}

