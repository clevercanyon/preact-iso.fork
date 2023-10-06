/**
 * Preact ISO.
 */

export { default as hydrate } from './hydrate.js';
export { ErrorBoundary, lazyRoute } from './lazy.js';
export { Location, Route, Router, useLocation, useRoute } from './router.js';

export function prerender(vnode, options) {
    return import('./prerender.js').then((m) => m.default(vnode, options));
}
