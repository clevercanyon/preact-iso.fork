/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

import { h, options, cloneElement } from 'preact';
import { renderToString } from 'preact-render-to-string';

/**
 * VNode hook reference.
 */
let vnodeHook; // Initialize.

/**
 * Previous vNode hook.
 */
const prevVNodeHook = options.vnode;

/**
 * Configures preact vNode hook.
 */
options.vnode = (vnode) => {
	if (prevVNodeHook) prevVNodeHook(vnode);
	if (vnodeHook) vnodeHook(vnode);
};

/**
 * Prerenders a vNode tree.
 *
 * @param {ReturnType<h>} vnode                 The root JSX element to render; e.g., `<App />`.
 * @param {object}        [options]             Supports `props` and `maxDepth`, which defaults to `10`.
 * @param {object}        [options.props]       Additional props to merge into the root JSX element.
 * @param {number}        [options.maxDepth=10] Max nested async operations to wait for before flushing.
 */
export default async function prerender(vnode, options = {}) {
	let tries = 0; // Initialize.
	const links = new Set();

	const props = options.props;
	const maxDepth = options.maxDepth || 10;

	if ('function' === typeof vnode) {
		vnode = h(vnode, props);
	} else if (props) {
		vnode = cloneElement(vnode, props);
	}
	const render = () => {
		if (++tries > maxDepth) return;
		try {
			return renderToString(vnode);
		} catch (e) {
			if (e && e.then) {
				return e.then(render);
			}
			throw e;
		}
	};
	vnodeHook = ({ type, props }) => {
		if ('a' === type && props && props.href) {
			if (!/^#/u.test(props.href) && /^(_?self)?$/iu.test(props.target || '')) {
				links.add(props.href);
			}
		}
	};
	try {
		return { html: await render(), links };
	} finally {
		vnodeHook = null;
	}
}
