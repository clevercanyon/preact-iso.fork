/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

import { render, hydrate as hydrativeRender } from 'preact';

/**
 * Initialize.
 */
let initialized = false; // Initialize.

/**
 * Web environment detection.
 */
const isWeb = 'Window' in globalThis;

/**
 * Client-side hydration.
 */
export default function hydrate(jsx, parent) {
	if (!isWeb) return; // Not applicable.

	parent = parent || document;

	if (!initialized) {
		initialized = true;
		hydrativeRender(jsx, parent);
	} else {
		render(jsx, parent);
	}
}
