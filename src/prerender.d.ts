import type { AnyComponent, VNode } from 'preact';

export type PrerenderOptions = Readonly<{
	maxDepth?: number;
	props?: Record<string, unknown>;
}>;
export type PrerenderResult = {
	html: string;
	links: Set<string>;
};
export default function prerender(vnode: AnyComponent | VNode, options?: PrerenderOptions): Promise<PrerenderResult>;
