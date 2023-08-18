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
 */
export function LazyErrorBoundary(props) {
	this.__c = (thrownPromise) => {
		thrownPromise.then(() => this.forceUpdate());
	};
	this.componentDidCatch = props.onError;
	return props.children; // Renders children.
}

/**
 * Lazy loader for dynamic imports.
 */
export default function lazy(load) {
	let p, c;
	return (props) => {
		const [, update] = useState(0);
		const r = useRef(c);
		if (!p) p = load().then((m) => (c = (m && m.default) || m));
		if (c !== undefined) return h(c, props);
		if (!r.current) r.current = p.then(() => update(1));
		throw p;
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
