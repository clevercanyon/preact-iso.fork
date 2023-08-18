/**
 * Preact ISO.
 */
/* eslint-env es2021, browser */

import { h, createContext, cloneElement, toChildArray } from 'preact';
import { useContext, useMemo, useReducer, useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Web environment detection.
 */
const isWeb = 'Window' in globalThis;

/**
 * Private variables needed below.
 */
const RouteContext = createContext({});
const RenderRef = ({ r }) => r.current;
const resolvedPromise = Promise.resolve();

/**
 * Location provider.
 */
export function Location(props) {
	const initialURL = new URL(props.url || (isWeb ? location.href : ''), isWeb ? location.origin : undefined);
	const [urlData, route] = useReducer(locationReducer, {
		wasPush: true,
		origin: initialURL.origin,
		pathQuery: initialURL.pathname + initialURL.search,
	});
	const value = useMemo(() => {
		const url = new URL(urlData.pathQuery, urlData.origin);
		const path = url.pathname.replace(/(.)\/$/u, '$1');

		const query = url.searchParams.size ? '?' + url.searchParams.toString() : '';
		const queryVars = Object.fromEntries(url.searchParams);

		return {
			route,
			wasPush: urlData.wasPush,
			path,
			pathQuery: path + query,
			query,
			queryVars,
		};
	}, [urlData]);

	useLayoutEffect(() => {
		addEventListener('click', route);
		addEventListener('popstate', route);

		return () => {
			removeEventListener('click', route);
			removeEventListener('popstate', route);
		};
	}, []);

	return h(Location.ctx.Provider, { value }, props.children);
}
Location.ctx = createContext({});
export const useLocation = () => useContext(Location.ctx);

/**
 * Location reducer.
 */
const locationReducer = (state, e) => {
	let newURL, isPush, isClick;

	if (null !== e && typeof e === 'object' && 'click' === e.type) {
		isClick = isPush = true;

		if (!isWeb) {
			return state; // Not possible.
		}
		if (typeof e.button === 'number' && 0 !== e.button) {
			return state; // Already handled by browser.
		}
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
			return state; // Already handled by browser.
		}
		const a = e.target.closest('a[href]');
		const aHref = a ? a.getAttribute('href') : '';

		if (!a || !a.href || !aHref) {
			return state; // Not applicable.
		}
		if (/^#/u.test(aHref) || !/^(_?self)?$/iu.test(a.target)) {
			return state; // Not applicable.
		}
		newURL = new URL(a.href, state.origin);
		//
	} else if (null !== e && typeof e === 'object') {
		isPush = true;

		if (!e.pathQuery) {
			return state; // Not applicable.
		}
		newURL = new URL(e.pathQuery, state.origin);
		//
	} else if (typeof e === 'string') {
		isPush = true;
		const pathQuery = e;

		if (!pathQuery) {
			return state; // Not applicable.
		}
		newURL = new URL(pathQuery, state.origin);
		//
	} /* e.g. Popstate events. */ else {
		if (!isWeb) {
			return state; // Not applicable.
		}
		newURL = new URL(location.href, state.origin);
	}
	if (!newURL || newURL.origin !== state.origin) {
		return state; // Not applicable.
	}
	if (isClick && isWeb) e.preventDefault();

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
 * Router magic.
 */
export function Router(props) {
	const [countState, update] = useReducer((c) => c + 1, 0);
	const { wasPush, path, pathQuery, query, queryVars } = useLocation();
	const { restPath = path, restPathQuery = pathQuery, params = {} } = useContext(RouteContext);

	// Previous path + query.
	const prevPathQuery = useRef(pathQuery);

	// Loading status.
	const isLoading = useRef(false);

	// Monotonic counter.
	const count = useRef(0);

	// The current route.
	const curRoute = useRef();

	// Previous route.
	const prevRoute = useRef();

	// Pending base.
	const pendingBase = useRef();

	// Has component ever committed?
	const hasEverCommitted = useRef(false);

	// Was most recent render successful (did not suspend)?
	const didSuspend = useRef();
	didSuspend.current = false;

	// Memoize current route.
	curRoute.current = useMemo(() => {
		// Prevents diffing when we swap `cur` to `prev`.
		if (this.__v && this.__v.__k) this.__v.__k.reverse();

		count.current++; // Increment counter.
		prevRoute.current = curRoute.current; // Store previous.

		let matchingChildVNode, defaultChildVNode;
		const routeChildCtxProps = {
			path: restPath,
			pathQuery: restPathQuery,
			restPath: '',
			restPathQuery: '',
			query,
			queryVars,
			params,
		};
		toChildArray(props.children).some((childVNode) => {
			if (pathMatchesRoute(restPath, childVNode.props.path, routeChildCtxProps)) {
				return (matchingChildVNode = cloneElement(childVNode, routeChildCtxProps));
			}
			if (childVNode.props.default) {
				defaultChildVNode = cloneElement(childVNode, routeChildCtxProps);
			}
		});
		return h(RouteContext.Provider, { value: routeChildCtxProps }, matchingChildVNode || defaultChildVNode);
	}, [pathQuery]);

	// If rendering succeeds synchronously, we shouldn't render the previous children.
	const prevRouteSnapshot = prevRoute.current;
	prevRoute.current = null; // Reset previous children.

	// Inspired by `_childDidSuspend()` solution from compat; learn more in `./lazy.js`.
	// Minified `__c` = `_childDidSuspend()`. See: <https://o5p.me/3gXT4t>.
	this.__c = (thrownPromise) => {
		// Mark the current render as having suspended.
		didSuspend.current = true;

		// The new route suspended, so keep the previous route around while it loads.
		prevRoute.current = prevRouteSnapshot;

		// Fire an event saying we're waiting for the route.
		if (props.onLoadStart) {
			props.onLoadStart(pathQuery);
		}
		// Flag as currently loading.
		isLoading.current = true;

		// Re-render on un-suspension.
		const countSnapshot = count.current;
		thrownPromise.then((/* When no longer in a suspended state. */) => {
			// Ignore this update if it isn't the most recently suspended update.
			if (countSnapshot !== count.current) return;

			// Successful route transition: un-suspend after a tick and stop rendering the old route.
			(prevRoute.current = null), resolvedPromise.then(update);
		});
	};

	useLayoutEffect(() => {
		// Current DOM for this component.
		const currentDOM = this.__v && this.__v.__e;

		// Ignore suspended renders (failed commits).
		if (didSuspend.current) {
			// If we've never committed, mark any hydration DOM for removal on the next commit.
			if (!hasEverCommitted.current && !pendingBase.current) {
				pendingBase.current = currentDOM;
			}
			return; // Stop here in this case.
		}

		// If this is the first ever successful commit and we didn't use the hydration DOM, remove it.
		if (!hasEverCommitted.current && pendingBase.current) {
			if (pendingBase.current !== currentDOM) {
				pendingBase.current.remove();
			}
			pendingBase.current = null;
		}

		// Mark component as having committed.
		hasEverCommitted.current = true; // Flag true.

		// The route is loaded and rendered?
		if (prevPathQuery.current !== pathQuery) {
			if (wasPush) scrollTo(0, 0);

			if (props.onLoadEnd && isLoading.current) {
				props.onLoadEnd(pathQuery);
			}
			if (props.onRouteChange) {
				props.onRouteChange(pathQuery);
			}
			isLoading.current = false;
			prevPathQuery.current = path;
		}
	}, [wasPush, pathQuery, countState]);

	// Note: curChildren MUST render first in order to set didSuspend & prev.
	return [h(RenderRef, { r: curRoute }), h(RenderRef, { r: prevRoute })];
}
Router.Provider = Location; // Location provider.
export const Route = (props) => h(props.component, props);
export const useRoute = () => useContext(RouteContext);

/**
 * Path checker; i.e., checks if a path matches a route.
 */
const pathMatchesRoute = (path, route, routeChildCtxProps) => {
	if (!path || !route || !routeChildCtxProps) {
		return; // Not possible.
	}
	const pathParts = path.split('/').filter(Boolean);
	const routeParts = route.split('/').filter(Boolean);

	for (let i = 0, pathPart, routePart; i < Math.max(pathParts.length, routeParts.length); i++) {
		// Path and route part variables.
		(pathPart = pathParts[i] || ''), (routePart = routeParts[i] || '');
		let [, routePartValueIsNamed, routePartValue, routePartFlag] = routePart.match(/^(:?)(.*?)([+*?]?)$/u);

		// Unnamed segment match.
		if (!routePartValueIsNamed && pathPart === routePartValue) continue;

		// Path `/foo/*` match .. facilitates nested routes.
		if (!routePartValueIsNamed && pathPart && '*' === routePartFlag) {
			routeChildCtxProps.restPath = '/' + pathParts.slice(i).map(decodeURIComponent).join('/');
			routeChildCtxProps.restPathQuery = routeChildCtxProps.restPath + routeChildCtxProps.query;
			break; // We can stop here on nested routes.
		}
		// Segment mismatch / missing required field.
		if (!routePartValueIsNamed || (!pathPart && '?' !== routePartFlag && '*' !== routePartFlag)) return;

		// Named route part values.
		if ('+' === routePartFlag || '*' === routePartFlag) {
			pathPart = pathParts.slice(i).map(decodeURIComponent).join('/');
		} else if (pathPart) {
			pathPart = decodeURIComponent(pathPart);
		}
		routeChildCtxProps.params[routePartValue] = pathPart;
		if ('+' === routePartFlag || '*' === routePartFlag) break;
	}
	return routeChildCtxProps;
};
