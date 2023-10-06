/**
 * Preact ISO.
 */

import { cloneElement, createContext, h, toChildArray } from 'preact';
import { useContext, useLayoutEffect, useMemo, useReducer, useRef } from 'preact/hooks';
import { isWeb } from './env.js';

/**
 * Simply a resolved promise.
 */
const resolvedPromise = Promise.resolve();

/**
 * Component that renders a ref’s `.current` value.
 */
const RenderRef = ({ r }) => r.current; // Fn component.

/**
 * Right trims trailing slashes.
 *
 * @param   str String to trim slashes from.
 *
 * @returns     String with no trailing slashes.
 *
 * @note This won’t trim a lone slash; i.e., root of site.
 *
 * @see https://regex101.com/r/xCaqwz/1
 */
const rSmartTrimSlashes = (str) => {
    return str.replace(/(.)\/+$/u, '$1');
};

/**
 * Escapes regular expression string.
 *
 * @param   str String to escape.
 *
 * @returns     Escaped string.
 */
const escRegExp = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
};

/**
 * Removes base path from a URL path parts string.
 *
 * @param   baseURL         Base URL with a possible base path.
 * @param   urlPathPartsStr URL path parts string to remove base path from.
 *
 * @returns                 `urlPathPartsStr` minus base path in `baseURL`.
 */
const removeBasePath = (baseURL, urlPathPartsStr) => {
    const basePath = rSmartTrimSlashes(baseURL.pathname);
    if (!basePath || '/' === basePath) return urlPathPartsStr; // Nothing to remove.
    return urlPathPartsStr.replace(new RegExp('^' + escRegExp(basePath) + '($|[?#/])', 'u'), '$1');
};

/**
 * Removes query and hash from a URL parts string.
 *
 * @param   urlPartsStr URL parts string to remove query and hash from.
 *
 * @returns             `urlPartsStr` minus query and hash.
 */
const removeQueryHash = (urlPartsStr) => {
    return urlPartsStr.replace(/[?#].*$/u, '');
};

/**
 * Location component; i.e., context provider.
 *
 * @param   props Location component props.
 *
 * @returns       Location component; i.e., context provider.
 */
export function Location(props) {
    const [state, updateState] = useReducer(
        locationReducer, // Location state reducer.
        undefined, // `undefined` arg to init function.
        () => initialLocationState(props),
    );
    const context = /* Calculate only when state changes. */ useMemo(() => {
        const url = new URL(state.pathQuery, state.baseURL);
        url.pathname = rSmartTrimSlashes(url.pathname);
        url.hash = ''; // Don't use this in routing.

        const canonicalURL = new URL(removeQueryHash(url.toString()));
        canonicalURL.pathname = rSmartTrimSlashes(canonicalURL.pathname);
        canonicalURL.hash = ''; // Don't use this in canonicals.

        return {
            state: {
                ...state,

                url, // URL object.
                canonicalURL, // URL object.

                path: removeBasePath(state.baseURL, url.pathname),
                pathQuery: removeBasePath(state.baseURL, url.pathname + url.search),

                query: url.search, // Includes leading `?`.
                queryVars: Object.fromEntries(url.searchParams),
            },
            updateState, // i.e., Location reducer updates state.
        };
    }, [state.wasPush, state.pathQuery]);

    useLayoutEffect(() => {
        addEventListener('click', updateState);
        addEventListener('popstate', updateState);

        return () => {
            removeEventListener('click', updateState);
            removeEventListener('popstate', updateState);
        };
    }, [state.wasPush, state.pathQuery]);

    return h(Location.ctx.Provider, { value: context }, props.children);
}
Location.ctx = createContext({}); // Location context.
export const useLocation = () => useContext(Location.ctx);

/**
 * Router component and child Route components.
 *
 * @param   props Router component props.
 *
 * @returns       Rendered refs; i.e,. current and previous routes.
 */
export function Router(props) {
    const context = useRoute();
    const { state: locState } = useLocation();
    const [layoutTicks, updateLayoutTicks] = useReducer((c) => c + 1, 0);

    const routeCounter = useRef(0);
    const routerHasEverCommitted = useRef(false);

    const previousRoute = useRef();
    const prevLocationWasPush = useRef(locState.wasPush);
    const prevLocationPathQuery = useRef(locState.pathQuery);

    const currentRoute = useRef();
    const currentRouteDidSuspend = useRef();
    const currentRouteIsLoading = useRef(false);
    const currentRoutePendingHydrationDOM = useRef();

    currentRouteDidSuspend.current = false; // Reinitialize.

    // Memoizes current route.
    currentRoute.current = useMemo(() => {
        let matchingChildVNode, defaultChildVNode;

        // Prevents diffing when we swap `cur` to `prev`.
        if (this.__v && this.__v.__k) this.__v.__k.reverse();

        routeCounter.current++; // Increments monotonic route counter.
        previousRoute.current = currentRoute.current; // Stores current as previous.
        // ↑ Current route is being defined, so 'current' is actually previous here.

        // Current route context props must reflect the 'rest*' props.
        // i,e., In current context of potentially nested routers.
        let routeContextProps = {
            path: context.restPath || locState.path,
            pathQuery: context.restPathQuery || locState.pathQuery,

            restPath: '', // Potentially populated by `pathMatchesRoutePattern()`.
            restPathQuery: '', // Potentially populated by `pathMatchesRoutePattern()`.

            query: locState.query, // Always the same query vars across all nested routes.
            queryVars: locState.queryVars, // Always the same query vars across all nested routes.

            params: {}, // Potentially populated by `pathMatchesRoutePattern()`.
        };
        toChildArray(props.children).some((childVNode) => {
            let matchingRouteContextProps; // Initialize.

            if ((matchingRouteContextProps = pathMatchesRoutePattern(context.restPath || locState.path, childVNode.props.path, routeContextProps))) {
                return (matchingChildVNode = cloneElement(childVNode, (routeContextProps = matchingRouteContextProps)));
            }
            if (childVNode.props.default) {
                defaultChildVNode = cloneElement(childVNode, routeContextProps);
            }
        });
        return h(Router.ctx.Provider, { value: routeContextProps }, matchingChildVNode || defaultChildVNode);
    }, [locState.wasPush, locState.pathQuery]);

    // If rendering succeeds synchronously, we shouldn't render previous children.
    const previousRouteSnapshot = previousRoute.current;
    previousRoute.current = null; // Reset previous children.

    // Inspired by `_childDidSuspend()` solution from compat; learn more in `./lazy.js`.
    // Minified `__c` = `_childDidSuspend()`. See: <https://o5p.me/3gXT4t>.
    this.__c = (thrownPromise) => {
        // Mark current render as having suspended.
        currentRouteDidSuspend.current = true;

        // The new route suspended, so keep the previous route around while it loads.
        previousRoute.current = previousRouteSnapshot;

        // Fire an event saying we're waiting for the route.
        if (props.onLoadStart) props.onLoadStart();

        // Flag as currently loading.
        currentRouteIsLoading.current = true;

        // Re-render on un-suspension.
        const routeCounterSnapshot = routeCounter.current; // Snapshot.

        thrownPromise.then((/* When no longer in a suspended state. */) => {
            // Ignore this update if it isn't the most recently suspended update.
            if (routeCounterSnapshot !== routeCounter.current) return;

            // Successful route transition: un-suspend after a tick and stop rendering the old route.
            (previousRoute.current = null), resolvedPromise.then(updateLayoutTicks); // Triggers a new layout effect below.
        });
    };
    useLayoutEffect(() => {
        // Current route's hydration DOM.
        const currentRouteHydrationDOM = this.__v?.__e;

        // Ignore suspended renders (failed commits).
        if (currentRouteDidSuspend.current) {
            // If we've never committed, mark any hydration DOM for removal on the next commit.
            if (!routerHasEverCommitted.current && !currentRoutePendingHydrationDOM.current) {
                currentRoutePendingHydrationDOM.current = currentRouteHydrationDOM;
            }
            return; // Stop here in this case.
        }
        // If this is the first ever successful commit and we didn't use the hydration DOM, remove it.
        if (!routerHasEverCommitted.current && currentRoutePendingHydrationDOM.current) {
            if (currentRoutePendingHydrationDOM.current !== currentRouteHydrationDOM) {
                currentRoutePendingHydrationDOM.current.remove();
            }
            currentRoutePendingHydrationDOM.current = null; // Nullify after check complete.
        }
        // Mark router as having committed; i.e., as we are doing now.
        routerHasEverCommitted.current = true; // Obviously true at this point.

        // The new current route is loaded and rendered?
        if (prevLocationWasPush.current !== locState.wasPush || prevLocationPathQuery.current !== locState.pathQuery) {
            if (locState.wasPush) scrollTo(0, 0);

            if (props.onLoadEnd && currentRouteIsLoading.current) props.onLoadEnd();
            if (props.onRouteChange) props.onRouteChange();

            (prevLocationWasPush.current = locState.wasPush), (prevLocationPathQuery.current = locState.pathQuery);
            currentRouteIsLoading.current = false; // Loading complete.
        }
    }, [locState.wasPush, locState.pathQuery, layoutTicks]);

    // Note: `currentRoute` MUST render first to trigger a thrown promise.
    return [h(RenderRef, { r: currentRoute }), h(RenderRef, { r: previousRoute })];
}
Router.ctx = createContext({}); // Router context.
Router.Provider = Location; // Router's location provider.
export const Route = (props) => h(props.component, props);
export const useRoute = () => useContext(Router.ctx);

/**
 * Initial location component state.
 *
 * @param   props Location component props.
 *
 * @returns       Initial location component state.
 */
const initialLocationState = (props) => {
    let baseURL, url; // Initialize.

    if (props.baseURL instanceof URL) {
        baseURL = props.baseURL;
    } else if ('string' === typeof props.baseURL && props.baseURL.length) {
        baseURL = new URL(props.baseURL);
    } else if (isWeb) {
        baseURL = new URL(document.querySelector('head > base[href]')?.href || location.origin);
    } else {
        throw new Error('Missing `baseURL`.', props);
    }
    if (props.url instanceof URL) {
        url = props.url;
    } else if ('string' === typeof props.url && props.url.length) {
        url = new URL(props.url, baseURL);
    } else if (isWeb) {
        url = new URL(location.href);
    } else {
        throw new Error('Missing `url`.', props);
    }
    if (baseURL.origin !== url.origin) {
        throw new Error('URL `origin` mismatch.', { props, baseURL, url });
    }
    return {
        wasPush: true,
        baseURL: baseURL, // URL object.
        pathQuery: removeBasePath(baseURL, url.pathname + url.search),
    };
};

/**
 * Reduces location state.
 *
 * @param   state Current location state.
 * @param   x     Event, state updates, or new `pathQuery` string.
 *
 * @returns       Updated location state; else original state if no changes.
 */
const locationReducer = (state, x) => {
    let newURL, isPush, isClick; // Initialize.

    if (null !== x && typeof x === 'object' && 'click' === x.type) {
        isClick = isPush = true; // Click event is a push.

        if (!isWeb) {
            return state; // Not possible.
        }
        if (typeof x.button === 'number' && 0 !== x.button) {
            // {@see https://o5p.me/OJrHBs} for details.
            return state; // Not a left-click; let browser handle.
        }
        if (x.ctrlKey || x.metaKey || x.altKey || x.shiftKey) {
            // {@see https://o5p.me/sxlcYO} for details.
            return state; // Not a plain left-click; let browser handle.
        }
        const a = x.target.closest('a[href]');
        const aHref = a ? a.getAttribute('href') : '';

        if (!a?.href?.length || !aHref?.length) {
            return state; // Not applicable; no href value.
        }
        if ('#' === aHref[0] /* Ignores hashes on current path. */) {
            return state; // Not applicable; i.e., simply an on-page hash change.
        }
        if (!/^(_?self)?$/iu.test(a.target) /* Ignores target !== `_self`. */) {
            return state; // Not applicable; i.e., targets a different tab/window.
        }
        newURL = new URL(a.href);
        //
    } else if (null !== x && typeof x === 'object' && 'popstate' === x.type) {
        // Popstate history event is a change, not a push.

        if (!isWeb) {
            return state; // Not applicable.
        }
        newURL = new URL(location.href);
        //
    } else if (null !== x && typeof x === 'object') {
        isPush = true; // Object passed in is a push.

        if ('string' !== typeof x.pathQuery || !x.pathQuery.length) {
            return state; // Not applicable.
        }
        newURL = new URL(x.pathQuery, state.baseURL);
        //
    } else if (typeof x === 'string') {
        isPush = true; // String passed in is a push.

        const pathQuery = x; // As `pathQuery`.

        if (!pathQuery.length) {
            return state; // Not applicable.
        }
        newURL = new URL(pathQuery, state.baseURL);
    }
    if (!newURL /* Ignores empty URLs and/or invalid updates. */) {
        return state; // Not applicable.
    }
    if (newURL.origin !== state.baseURL.origin /* Ignores external URLs. */) {
        return state; // Not applicable.
    }
    if (!['http:', 'https:'].includes(newURL.protocol) /* Ignores `mailto:`, `tel:`, etc. */) {
        return state; // Not applicable.
    }
    if (newURL.hash /* Ignores hashes on current `pathQuery`; let browser handle hash changes. */) {
        const newPathQueryHash = removeBasePath(state.baseURL, newURL.pathname + newURL.search + newURL.hash);
        if (new RegExp('^' + escRegExp(state.pathQuery) + '#', 'u').test(newPathQueryHash)) {
            return state; // Not applicable; i.e., simply an on-page hash change.
        }
    }
    if (isClick && isWeb) x.preventDefault();

    if (true === isPush && isWeb) {
        history.pushState(null, '', newURL);
    } else if (false === isPush && isWeb) {
        history.replaceState(null, '', newURL);
    }
    return {
        ...state,
        wasPush: isPush,
        pathQuery: removeBasePath(state.baseURL, newURL.pathname + newURL.search),
    };
};

/**
 * Path checker; i.e., checks if a path matches a route pattern.
 *
 * @param   path              Location path to compare/check.
 * @param   routePattern      Route pattern to compare/check.
 * @param   routeContextProps Route (child of Router) context props.
 *
 * @returns                   New `routeContextProps` when path matches route. When path does not match route pattern,
 *   `undefined` is returned. It’s perfectly OK to use `!` when testing if the return value is falsy.
 */
const pathMatchesRoutePattern = (path, routePattern, routeContextProps) => {
    if (!path || !routePattern || !routeContextProps) {
        return; // Not possible.
    }
    const pathParts = path.split('/').filter(Boolean);
    const routePatternParts = routePattern.split('/').filter(Boolean);
    const newRouteContextProps = structuredClone(routeContextProps); // Deep clone.

    for (let i = 0; i < Math.max(pathParts.length, routePatternParts.length); i++) {
        const pathPart = pathParts[i] || '';
        const routePatternPart = routePatternParts[i] || '';
        const [
            unusedꓺ$0, // Using `$1...$3` only.
            routePatternPartValueIsParam, // `$1`.
            routePatternPartValue, // `$2`.
            routePatternPartFlag, // `$3`.
        ] = routePatternPart.match(/^(:?)(.*?)([+*?]?)$/u);

        if (routePatternPartValueIsParam) {
            if (!pathPart && !['?', '*'].includes(routePatternPartFlag)) {
                return; // Missing a required path part param.
            }
            if (['+', '*'].includes(routePatternPartFlag) /* Greedy param. */) {
                newRouteContextProps.params[routePatternPartValue] = pathParts.slice(i).map(decodeURIComponent).join('/');
                break; // We can stop here on greedy params; i.e., we’ve got everything in this param now.
            } else if (pathPart) {
                newRouteContextProps.params[routePatternPartValue] = decodeURIComponent(pathPart);
            }
        } else {
            if (pathPart === routePatternPartValue) continue;

            if (pathPart && '*' === routePatternPartFlag) {
                newRouteContextProps.restPath = '/' + pathParts.slice(i).map(decodeURIComponent).join('/');
                newRouteContextProps.restPathQuery = newRouteContextProps.restPath + newRouteContextProps.query;
                break; // We can stop here; i.e., the rest can be parsed by nested routes.
            }
            return; // Part is missing, or not an exact match, and not a wildcard `*` match either.
        }
    }
    return newRouteContextProps;
};
