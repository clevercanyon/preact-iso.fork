import { AnyComponent, VNode } from 'preact';

export type LocationProps = {
	route: (pathQuery: string) => void;
	wasPush: boolean;
	path: string;
	pathQuery: string;
	query: string;
	queryVars: Record<string, string>;
};
export type RouteProps = {
	path: string;
	pathQuery: string;
	restPath: string;
	restPathQuery: string;
	query: string;
	queryVars: Record<string, string>;
	params: Record<string, string>;
};

export function Location(props: {
	children?: VNode[];
	url?: string; // Required for SSR.
}): VNode;

export function Router(props: {
	children?: VNode[]; //
	onLoadEnd?: (pathQuery: string) => void;
	onLoadStart?: (pathQuery: string) => void;
	onRouteChange?: (pathQuery: string) => void;
}): VNode;

export function Route(props: {
	path?: string; //
	default?: boolean;
	component?: AnyComponent<RouteProps>;
}): VNode;

export const useLocation: () => Readonly<LocationProps>;
export const useRoute: () => ReadOnly<RouteProps>;
