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

	let isoData = document.querySelector('script[type=preact-iso-data]');
	parent = parent || (isoData && isoData.parentNode) || document;

	if (!initialized && isoData) {
		hydrativeRender(jsx, parent);
	} else {
		render(jsx, parent);
	}
	initialized = true;
}
