import type { AnyComponent, VNode } from 'preact';

export interface PrerenderOptions {
	maxDepth?: number;
	props?: Record<string, unknown>;
}
export interface PrerenderResult {
	html: string;
	links?: Set<string>;
}
export default function prerender(vnode: AnyComponent | VNode, options?: PrerenderOptions): Promise<PrerenderResult>;
