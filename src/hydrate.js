/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

import { hydrate as hydrativeRender } from 'preact';

/**
 * Client-side hydration.
 */
export default function hydrate(jsx, parent) {
	hydrativeRender(jsx, parent || document);
}
