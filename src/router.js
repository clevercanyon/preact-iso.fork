/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

import { isWeb } from './env.js';
import { h, createContext, cloneElement, toChildArray } from 'preact';
import { useContext, useMemo, useReducer, useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Private variables needed below.
 */
const RenderRef = ({ r }) => r.current;
const resolvedPromise = Promise.resolve();

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
		undefined, // Initial state produced by init function.
		() => initialLocationState(props),
	);
	const context = /* Calculate only when state changes. */ useMemo(() => {
		const url = new URL(state.pathQuery, state.origin);

		url.pathname = url.pathname.replace(/(.)\/$/u, '$1');
		url.hash = ''; // We don't ever use this in routing.

		const canonicalURL = new URL(url.toString().replace(/[?#].*$/gu, ''));
		canonicalURL.pathname = canonicalURL.pathname.replace(/(.)\/$/u, '$1');

		return {
			state: {
				wasPush: state.wasPush,
				origin: url.origin,

				url,
				canonicalURL,

				path: url.pathname,
				pathQuery: url.pathname + url.search,

				query: url.search, // Includes leading `?`.
				queryVars: Object.fromEntries(url.searchParams),
			},
			updateState, // i.e., Location reducer updates state.
		};
	}, [state.wasPush, state.origin, state.pathQuery]);

	useLayoutEffect(() => {
		addEventListener('click', updateState);
		addEventListener('popstate', updateState);

		return () => {
			removeEventListener('click', updateState);
			removeEventListener('popstate', updateState);
		};
	}, [state.wasPush, state.origin, state.pathQuery]);

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
	const context = useContext(Router.ctx);
	const { state: locState } = useLocation();
	const [layoutTicks, updateLayoutTicks] = useReducer((c) => c + 1, 0);

	const routeCounter = useRef(0);
	const routerHasEverCommitted = useRef(false);

	const previousRoute = useRef();
	const prevLocationWasPush = useRef(locState.wasPush);
	const prevLocationOrigin = useRef(locState.origin);
	const prevLocationPathQuery = useRef(locState.pathQuery);

	const currentRoute = useRef();
	const currentRouteDidSuspend = useRef();
	const currentRouteIsLoading = useRef(false);
	const currentRoutePendingHydrationDOM = useRef();

	currentRouteDidSuspend.current = false; // Reinitialize.

	// Memoize current route.
	currentRoute.current = useMemo(() => {
		let matchingChildVNode, defaultChildVNode;

		// Prevents diffing when we swap `cur` to `prev`.
		if (this.__v && this.__v.__k) this.__v.__k.reverse();

		routeCounter.current++; // Increments monotonic route counter.
		previousRoute.current = currentRoute.current; // Stores current as previous.
		// Current route is being defined, so 'current' is actually previous here.

		// Current route context props reflect the 'rest'.
		// i,e., in current context of potentially nested routers.
		let routeContextProps = {
			path: context.restPath || locState.path,
			pathQuery: context.restPathQuery || locState.pathQuery,
			restPath: '', // Potentially populated by `pathMatchesRoutePattern()`.
			restPathQuery: '', // Potentially populated by `pathMatchesRoutePattern()`.
			query: locState.query, // Always the same ones.
			queryVars: locState.queryVars, // Always the same ones.
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
	}, [locState.wasPush, locState.origin, locState.pathQuery]);

	// If rendering succeeds synchronously, we shouldn't render the previous children.
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
		if (prevLocationWasPush.current !== locState.wasPush || prevLocationOrigin.current !== locState.origin || prevLocationPathQuery.current !== locState.pathQuery) {
			if (locState.wasPush) scrollTo(0, 0);

			if (props.onLoadEnd && currentRouteIsLoading.current) props.onLoadEnd();
			if (props.onRouteChange) props.onRouteChange();

			(prevLocationWasPush.current = locState.wasPush), (prevLocationOrigin.current = locState.origin), (prevLocationPathQuery.current = locState.path);
			currentRouteIsLoading.current = false; // Loading complete.
		}
	}, [locState.wasPush, locState.origin, locState.pathQuery, layoutTicks]);

	// Note: `currentRoute` MUST render first in order to trigger a thrown promise.
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
	let url; // Initialize.

	if (props.url instanceof URL) {
		url = props.url; // Easy peasy.
		//
	} else if ('string' === typeof props.url) {
		url = new URL(props.url, isWeb ? location.origin : undefined);
		//
	} else {
		url = new URL(isWeb ? location.href : '', isWeb ? location.origin : undefined);
	}
	return {
		wasPush: true,
		origin: url.origin,
		pathQuery: url.pathname + url.search,
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
		isClick = isPush = true;

		if (!isWeb) {
			return state; // Not possible.
		}
		if (typeof x.button === 'number' && 0 !== x.button) {
			return state; // Already handled by browser.
		}
		if (x.ctrlKey || x.metaKey || x.altKey || x.shiftKey) {
			return state; // Already handled by browser.
		}
		const a = x.target.closest('a[href]');
		const aHref = a ? a.getAttribute('href') : '';

		if (!a || !a.href || !aHref) {
			return state; // Not applicable.
		}
		if (/^#/u.test(aHref) || !/^(_?self)?$/iu.test(a.target)) {
			return state; // Not applicable.
		}
		newURL = new URL(a.href, state.origin);
		//
	} else if (null !== x && typeof x === 'object' && 'popstate' === x.type) {
		if (!isWeb) {
			return state; // Not applicable.
		}
		newURL = new URL(location.href, state.origin);
		//
	} else if (null !== x && typeof x === 'object') {
		isPush = true;

		if (!x.pathQuery || 'string' !== typeof x.pathQuery) {
			return state; // Not applicable.
		}
		newURL = new URL(x.pathQuery, state.origin);
		//
	} else if (typeof x === 'string') {
		isPush = true;
		const pathQuery = x;

		if (!pathQuery) {
			return state; // Not applicable.
		}
		newURL = new URL(pathQuery, state.origin);
	}
	if (!newURL || newURL.origin !== state.origin) {
		return state; // Not applicable.
	}
	if (isClick && isWeb) x.preventDefault();

	if (true === isPush && isWeb) {
		history.pushState(null, '', newURL);
	} else if (false === isPush && isWeb) {
		history.replaceState(null, '', newURL);
	}
	return {
		wasPush: isPush,
		origin: newURL.origin,
		pathQuery: newURL.pathname + newURL.search,
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
