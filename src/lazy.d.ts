import type { RenderableProps, VNode } from 'preact';

export type ErrorBoundaryProps = RenderableProps<{ onError?: (error: Error) => void }>;

export function ErrorBoundary(props: ErrorBoundaryProps): VNode;
export function lazyRoute<Type>(loader: () => Promise<{ default: Type } | Type>): Type;
