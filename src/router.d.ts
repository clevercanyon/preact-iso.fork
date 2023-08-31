import type { AnyComponent, ComponentChildren, VNode } from 'preact';

export type LocationProps = Readonly<{
	children?: ComponentChildren;
	url?: URL | string; // Required for SSR.
}>;
export type LocationContext = Readonly<{
	state: {
		wasPush: boolean;
		origin: string;

		url: URL;
		canonicalURL: URL;

		path: string;
		pathQuery: string;

		query: string;
		queryVars: Record<string, string>;
	};
	updateState: (pathQuery: string) => void;
}>;
export type RouterProps = Readonly<{
	children?: ComponentChildren;
	onLoadEnd?: () => void;
	onLoadStart?: () => void;
	onRouteChange?: () => void;
}>;
export type RouteProps = Readonly<{
	path?: string;
	default?: boolean;
	component: AnyComponent<RouteContextAsProps>;
}>;
export type RouteContext = Readonly<{
	path: string;
	pathQuery: string;

	restPath: string;
	restPathQuery: string;

	query: string;
	queryVars: Record<string, string>;

	params: Record<string, string>;
}>;
export type RouteContextAsProps = RouteContext & RouteProps;

export function Router(props: RouterProps): VNode<RouterProps>;
export function Location(props: LocationProps): VNode<LocationProps>;
export function Route(props: RouteProps): VNode<RouteProps>;

export const useLocation: () => LocationContext;
export const useRoute: () => RouteContext;
