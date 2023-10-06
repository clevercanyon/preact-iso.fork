/**
 * Preact ISO.
 */
// Effectively the same as `@clevercanyon/utilities/env.isWeb()`.

export const isWeb = 'Window' in globalThis && Window instanceof Function
    && (globalThis instanceof Window
        || ('Navigator' in globalThis && Navigator instanceof Function &&
            'navigator' in globalThis && navigator instanceof Navigator &&
            navigator.userAgent.includes('jsdom/'))
    ); // prettier-ignore
