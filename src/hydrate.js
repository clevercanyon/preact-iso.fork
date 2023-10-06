/**
 * Preact ISO.
 */

import { hydrate as hydrativeRender } from 'preact';

/**
 * Client-side hydration.
 */
export default function hydrate(jsx, parent) {
    hydrativeRender(jsx, parent || document);
}
