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
export function ErrorBoundary(props) {
	this.__c /* `._childDidSuspend()` */ = (thrownPromise) => {
		thrownPromise.then(() => this.forceUpdate());
	};
	this.componentDidCatch = props.onError;
	return props.children; // Renders children.
}

/**
 * Lazy loader for components.
 *
 * @note Inspired by `Suspense` from preact/compat. See: <https://o5p.me/TA863r>.
 */
export function lazyComponent(loader) {
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
 * @note Inspired by `Suspense` from preact/compat. See: <https://o5p.me/TA863r>.
 */
options.__e = (err, newVNode, oldVNode) => {
	if (err && err.then /* Error is a promise? */) {
		let v = newVNode; // New vnode.

		while ((v = v.__) /* While `._parent()` exists, recursively. */) {
			if (v.__c && v.__c.__c /* If `._component`.`_childDidSuspend()` exists. */) {
				if (!newVNode.__e /* If `._dom()` is missing. */) {
					newVNode.__e = oldVNode.__e; // `._dom`.
					newVNode.__k = oldVNode.__k; // `._children`.
				}
				if (!newVNode.__k) newVNode.__k = []; // `._children`.

				// Effectively skips `prevErrorHandler` in such a case.
				return v.__c.__c(err, newVNode); // Calls `._component`.`_childDidSuspend()`.
			}
		}
	}
	if (prevErrorHandler) {
		prevErrorHandler(err, newVNode, oldVNode);
	}
};
