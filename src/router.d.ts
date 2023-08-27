import { AnyComponent, ComponentChildren, VNode } from 'preact';

export type LocationProps = {
	children?: ComponentChildren;
	url?: URL | string; // Required for SSR.
};
export type LocationContext = {
	route: (pathQuery: string) => void;
	wasPush: boolean;
	origin: string;

	url: URL;
	canonicalURL: URL;

	path: string;
	pathQuery: string;

	query: string;
	queryVars: Record<string, string>;
};
export type RouterProps = {
	children?: ComponentChildren;
	onLoadEnd?: (pathQuery: string) => void;
	onLoadStart?: (pathQuery: string) => void;
	onRouteChange?: (pathQuery: string) => void;
};
export type RouteProps = {
	path?: string;
	default?: boolean;
	component: AnyComponent<RouteContextAsProps>;
};
export type RouteContext = {
	path: string;
	pathQuery: string;

	restPath: string;
	restPathQuery: string;

	query: string;
	queryVars: Record<string, string>;

	params: Record<string, string>;
};
export type RouteContextAsProps = RouteContext;

export function Router(props: RouterProps): VNode<RouterProps>;
export function Location(props: LocationProps): VNode<LocationProps>;
export function Route(props: RouteProps): VNode<RouteProps>;

export const useLocation: () => Readonly<LocationContext>;
export const useRoute: () => Readonly<RouteContext>;
