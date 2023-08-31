import type { VNode, RenderableProps } from 'preact';

export type ErrorBoundaryProps = RenderableProps<{ onError?: (error: Error) => void }>;

export function ErrorBoundary(props: ErrorBoundaryProps): VNode;
export function lazyComponent<T>(loader: () => Promise<{ default: T } | T>): T;
