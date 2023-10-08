import type { AnyComponent, RenderableProps, VNode } from 'preact';

export type LocationProps = RenderableProps<
    Readonly<{
        url?: URL | string;
        base?: URL | string;
    }>
>;
export type LocationContext = Readonly<{
    state: {
        // URL push?
        wasPush: boolean;

        // Full URLs.
        url: URL;
        base: URL;
        canonicalURL: URL;

        // Relative `./` to base.
        path: string;
        pathQuery: string;

        // Query variables.
        query: string;
        queryVars: Record<string, string>;
    };
    updateState: (pathQuery: string) => void;
}>;
export type RouterProps = RenderableProps<
    Readonly<{
        onLoadEnd?: () => void;
        onLoadStart?: () => void;
        onRouteChange?: () => void;
    }>
>;
export type RouteProps = RenderableProps<
    Readonly<{
        path?: string;
        default?: boolean;
        component: AnyComponent<RouteContextAsProps>;
    }>
>;
export type RouteContext = Readonly<{
    // Relative `./` to base.
    path: string;
    pathQuery: string;

    // Relative `./` to base.
    restPath: string;
    restPathQuery: string;

    // Query variables.
    query: string;
    queryVars: Record<string, string>;

    // Path parameter keys/values.
    params: Record<string, string>;
}>;
export type RouteContextAsProps = RouteContext;

export function Router(props: RouterProps): VNode<RouterProps>;
export function Location(props: LocationProps): VNode<LocationProps>;
export function Route(props: RouteProps): VNode<RouteProps>;

export const useLocation: () => LocationContext;
export const useRoute: () => RouteContext;
