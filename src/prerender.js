/**
 * Preact ISO.
 */

import { cloneElement, h } from 'preact';
import { renderToString } from 'preact-render-to-string';

/**
 * Prerenders a vNode tree.
 *
 * @param {ReturnType<h>} vnode                 The root JSX element to render; e.g., `<App />`.
 * @param {object}        [options]             Supports `props` and `maxDepth`, which defaults to `10`.
 * @param {object}        [options.props]       Additional props to merge into the root JSX element.
 * @param {number}        [options.maxDepth=10] Max nested async operations to wait for before flushing.
 */
export default async function prerender(vnode, options = {}) {
    const { props = {}, maxDepth = 10 } = options;
    let currentDepth = 0; // Initializes current depth.

    if ('function' === typeof vnode) {
        vnode = h(vnode, props);
    } else if (props) {
        vnode = cloneElement(vnode, props);
    }
    const render = () => {
        if (++currentDepth > maxDepth) {
            throw new Error('Max prerender depth: `' + maxDepth + '`.');
        }
        try {
            return renderToString(vnode);
        } catch (thrown) {
            if (thrown && thrown.then) {
                return thrown.then(render);
            } else throw thrown;
        }
    };
    return { html: await render() };
}
