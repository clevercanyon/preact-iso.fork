import type { AnyComponent, VNode } from 'preact';

export type PrerenderOptions = Readonly<{
    props?: { [x: string]: unknown };
    maxDepth?: number;
}>;
export type PrerenderResult = {
    html: string;
};
export default function prerender(vnode: AnyComponent | VNode, options?: PrerenderOptions): Promise<PrerenderResult>;
