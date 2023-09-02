/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

export { Location, Router, Route, useLocation, useRoute } from './router.js';
export { ErrorBoundary, lazyImport } from './lazy.js';
export { default as hydrate } from './hydrate.js';

export function prerender(vnode, options) {
	return import('./prerender.js').then((m) => m.default(vnode, options));
}
