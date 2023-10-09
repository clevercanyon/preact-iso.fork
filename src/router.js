/**
 * Preact ISO.
 */

import { $env, $is, $str, $url } from '@clevercanyon/utilities';
import { cloneElement, createContext, h, toChildArray } from 'preact';
import { useContext, useLayoutEffect, useMemo, useReducer, useRef } from 'preact/hooks';

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
        const url = $url.parse(state.pathQuery, state.baseURL);
        const canonicalURL = $url.parse($url.toCanonical(url));

        // Forces a canonical path for consistency.
        url.pathname = canonicalURL.pathname; // Consistency.

        return {
            state: {
                ...state, // State.
                // `wasPush: boolean`.

                // Base URL & path.
                baseURL: state.baseURL, // URL instance.
                // ↓ Typically has a trailing slash.
                basePath: $url.toPath(state.baseURL),

                // Current URL w/o hash.
                url, // URL instance.
                canonicalURL, // URL instance.

                // These are `./` relative to base.
                path: $url.removeBasePath($url.toPath(url), state.baseURL),
                pathQuery: $url.removeBasePath($url.toPathQuery(url), state.baseURL),

                // Query variables.
                query: url.search, // Leading `?`.
                queryVars: $url.getQueryVars(url),

                // Utility methods.

                fromBase(parseable) {
                    return $url.parse(parseable, state.baseURL).toString();
                },
                pathFromBase(parseable) {
                    return $url.toPathQueryHash($url.parse(parseable, state.baseURL));
                },
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
 * @returns       Rendered refs (current and previous routes).
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
        let routeContext = {
            // These are `./` relative to base.
            path: context.restPath || locState.path,
            pathQuery: context.restPathQuery || locState.pathQuery,

            // These are `./` relative to base.
            restPath: '', // Potentially populated by `pathMatchesRoutePattern()`.
            restPathQuery: '', // Potentially populated by `pathMatchesRoutePattern()`.

            // Query variables.
            query: locState.query, // Always the same query vars across all nested routes.
            queryVars: locState.queryVars, // Always the same query vars across all nested routes.

            // Path parameter keys/values.
            params: {}, // Potentially populated by `pathMatchesRoutePattern()`.
        };
        toChildArray(props.children).some((childVNode) => {
            let matchingRouteContext; // Initialize.

            if ((matchingRouteContext = pathMatchesRoutePattern(context.restPath || locState.path, childVNode.props.path, routeContext))) {
                return (matchingChildVNode = cloneElement(childVNode, (routeContext = matchingRouteContext)));
            }
            if (!defaultChildVNode && childVNode.props.default) {
                defaultChildVNode = cloneElement(childVNode, routeContext);
            }
        });
        return h(Router.ctx.Provider, { value: routeContext }, matchingChildVNode || defaultChildVNode);
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
            if (locState.wasPush && $env.isWeb() /* Handles scroll location. */) {
                const currentHash = $url.currentHash(); // e.g., `element-id`.
                const currentHashElementById = currentHash ? document.getElementById(currentHash) : null;

                if (currentHashElementById) {
                    currentHashElementById.scrollIntoView();
                } else scrollTo(0, 0); // To top of page.
            }
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

/* ---
 * Misc utilities.
 */

/**
 * Simply a resolved promise.
 */
const resolvedPromise = Promise.resolve();

/**
 * Component that renders a ref’s `.current` value.
 */
const RenderRef = ({ r }) => r.current; // Function comp.

/**
 * Initial location component state.
 *
 * @param   props Location component props.
 *
 * @returns       Initial location component state.
 */
const initialLocationState = (props) => {
    let { url, baseURL } = props; // Initialize.

    if (baseURL && $is.url(baseURL)) {
        baseURL = $url.parse(baseURL);
    } else if (baseURL && $is.string(baseURL)) {
        baseURL = $url.parse(baseURL);
    } else if ($env.isWeb()) {
        baseURL = $url.parse($url.currentBase());
    } else {
        throw new Error('Missing `baseURL`.', props);
    }
    // We intentionally do not trim a trailing slash from the base URL.
    // The trailing slash is important to `URL()` when forming paths from base.

    if (url && $is.url(url)) {
        url = $url.parse(url, baseURL);
    } else if (url && $is.string(url)) {
        url = $url.parse(url, baseURL);
    } else if ($env.isWeb()) {
        url = $url.parse($url.current(), baseURL);
    } else {
        throw new Error('Missing `url`.', props);
    }
    // Forces a canonical path for consistency.
    url.pathname = $url.parse($url.toCanonical(url)).pathname;

    if (url.origin !== baseURL.origin) {
        throw new Error('URL `origin` mismatch.', { url, baseURL });
    }
    return {
        wasPush: true,
        baseURL, // Does not change.
        // This is `./` relative to base.
        pathQuery: $url.removeBasePath($url.toPathQuery(url), baseURL),
    };
};

/**
 * Reduces location state.
 *
 * @param   state Current location state.
 * @param   x     Event or another type of state update.
 *
 * @returns       New state; else original state if no changes.
 */
const locationReducer = (state, x) => {
    let url, isPush, isClick; // Initialize.
    // ---
    // Case handlers for various types of state updates.

    if (null !== x && typeof x === 'object' && 'click' === x.type) {
        isClick = isPush = true; // Click event is a push.

        if (!$env.isWeb()) {
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

        if (!a || !a.href || !aHref) {
            return state; // Not applicable; no href value.
        }
        if ('#' === aHref[0] /* Ignores hashes on current path. */) {
            return state; // Not applicable; i.e., simply an on-page hash change.
        }
        if (!/^(_?self)?$/iu.test(a.target) /* Ignores target !== `_self`. */) {
            return state; // Not applicable; i.e., targets a different tab/window.
        }
        url = $url.parse(a.href, state.baseURL);
        //
    } else if (null !== x && typeof x === 'object' && 'popstate' === x.type) {
        // Popstate history event is a change, not a push.

        if (!$env.isWeb()) {
            return state; // Not applicable.
        }
        url = $url.parse(location.href, state.baseURL);
        //
    } else if (null !== x && typeof x === 'object') {
        isPush = true; // Object passed in is a push.

        if (!x.pathQuery || 'string' !== typeof x.pathQuery) {
            return state; // Not applicable.
        }
        url = $url.parse($str.lTrim(x.pathQuery, '/'), state.baseURL);
        //
    } else if (typeof x === 'string') {
        isPush = true; // String passed in is a push.

        const pathQuery = x; // As `pathQuery`.

        if (!pathQuery) {
            return state; // Not applicable.
        }
        url = $url.parse($str.lTrim(pathQuery, '/'), state.baseURL);
    }
    // ---
    // Validates a potential state update.

    if (!url /* Ignores empty URLs and/or invalid updates. */) {
        return state; // Not applicable.
    }
    // Forces a canonical path for consistency.
    url.pathname = $url.parse($url.toCanonical(url)).pathname;

    if (url.origin !== state.baseURL.origin /* Ignores external URLs. */) {
        return state; // Not applicable.
    }
    if (!['http:', 'https:'].includes(url.protocol) /* Ignores `mailto:`, `tel:`, etc. */) {
        return state; // Not applicable.
    }
    if (url.hash /* Ignores on-page hash changes; i.e., let browser handle. */) {
        const newPathQueryHash = $url.removeBasePath($url.toPathQueryHash(url), state.baseURL);
        if (new RegExp('^' + $str.escRegExp(state.pathQuery) + '#', 'u').test(newPathQueryHash)) return state;
    } // In the case of a hash changing when the `pathQuery` changes, state updates, and our {@see Router()} handles.

    // ---
    // Updates state.

    if ($env.isWeb() /* Only possible in a browser. */) {
        if (isClick) x.preventDefault();

        if (true === isPush) {
            history.pushState(null, '', url);
        } else if (false === isPush) {
            history.replaceState(null, '', url);
        }
    }
    return {
        ...state,
        wasPush: isPush,
        // This is `./` relative to base.
        pathQuery: $url.removeBasePath($url.toPathQuery(url), state.baseURL),
    };
};

/**
 * Path checker; i.e., checks if a path matches a route pattern.
 *
 * @param   path         Relative location path; e.g., `./path/foo/bar` | `/path/foo/bar` | `path/foo/bar`.
 * @param   routePattern Relative route pattern; e.g., `./path/foo/*` | `/path/foo/*` | `path/foo/*`.
 * @param   routeContext Route context; {@see RouteContext}.
 *
 * @returns              A New `routeContext` clone when path matches route. When path does not match route pattern,
 *   `undefined` is returned. It’s perfectly OK to use `!` when testing if the return value is falsy.
 */
const pathMatchesRoutePattern = (path, routePattern, routeContext) => {
    if (!path || !routePattern || !routeContext) {
        return; // Not possible.
    }
    // These are `./` relative to base.
    const pathParts = $str.lTrim(path, './').split('/').filter(Boolean);
    const routePatternParts = $str.lTrim(routePattern, './').split('/').filter(Boolean);

    // Produces a deep clone that we may return.
    const newRouteContext = structuredClone(routeContext);

    // Iterates all parts of the longest between path and route pattern.
    // In the case of no parts whatsoever, across both of them, that’s also a match.
    // e.g., If the current path is `./` matched by a pattern of `./`, both are empty.

    for (let i = 0; i < Math.max(pathParts.length, routePatternParts.length); i++) {
        const pathPart = pathParts[i] || ''; // Default is empty string.
        const routePatternPart = routePatternParts[i] || ''; // Default is empty string.

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
            if (['+', '*'].includes(routePatternPartFlag) /* Greedy. */) {
                // Path parameter keys/values. Greedy, in this particular case.
                newRouteContext.params[routePatternPartValue] = pathParts.slice(i).map(decodeURIComponent).join('/');
                break; // We can stop here on greedy params; i.e., we’ve got everything in this param now.
            } else if (pathPart) {
                // Path parameter keys/values. A single part in this case.
                newRouteContext.params[routePatternPartValue] = decodeURIComponent(pathPart);
            }
        } else {
            if (pathPart === routePatternPartValue) continue;

            if (pathPart && '*' === routePatternPartFlag) {
                // These are `./` relative to base.
                newRouteContext.restPath = './' + pathParts.slice(i).join('/');
                newRouteContext.restPathQuery = newRouteContext.restPath + newRouteContext.query;
                break; // We can stop here; i.e., the rest can be parsed by nested routes.
            }
            return; // Part is missing, or not an exact match, and not a wildcard `*` match either.
        }
    }
    return newRouteContext;
};
