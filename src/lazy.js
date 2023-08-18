/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

import { h, options } from 'preact';
import { useState, useRef } from 'preact/hooks';

/**
 * Previous error handler.
 */
const prevErrorHandler = options.__e;

/**
 * Lazy error boundary.
 *
 * @note Minified `__c` = `_childDidSuspend()`. See: <https://o5p.me/3gXT4t>.
 */
export function ErrorBoundary(props) {
	this.__c = (thrownPromise) => {
		thrownPromise.then(() => this.forceUpdate());
	};
	this.componentDidCatch = props.onError;
	return props.children; // Renders children.
}

/**
 * Lazy loader for dynamic imports.
 *
 * @see https://www.npmjs.com/package/@clevercanyon/preact-iso.fork
 */
export default function lazy(loader) {
	let promise, component; // Initialize.

	return (props) => {
		const r = useRef(component);
		const [, update] = useState(0);

		if (!promise) {
			promise = loader().then((m) => {
				component = (m && m.default) || m;
			});
		}
		if (undefined !== component) {
			return h(component, props);
		}
		if (!r.current) {
			r.current = promise.then(() => update(1));
		}
		throw promise;
	};
}

/**
 * Configures error handler in support of lazy loads.
 *
 * @note Inspired by `_childDidSuspend()` solution from compat. See: <https://o5p.me/TA863r>.
 * @note Minified `__c` = `_childDidSuspend()`. See: <https://o5p.me/3gXT4t>.
 * @note Minified `__e` = `_catchError()`. See: <https://o5p.me/GppuQB>.
 */
options.__e = (err, newVNode, oldVNode) => {
	if (err && err.then) {
		let v = newVNode;
		while ((v = v.__)) {
			if (v.__c && v.__c.__c) {
				if (newVNode.__e == null) {
					newVNode.__e = oldVNode.__e; // `._dom`.
					newVNode.__k = oldVNode.__k; // `._children`.
				}
				if (!newVNode.__k) newVNode.__k = [];
				return v.__c.__c(err, newVNode);
			}
		}
	}
	if (prevErrorHandler) {
		prevErrorHandler(err, newVNode, oldVNode);
	}
};
