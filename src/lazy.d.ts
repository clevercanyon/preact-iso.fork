import type { VNode, RenderableProps } from 'preact';

export default function lazy<T>(load: () => Promise<{ default: T } | T>): T;
export function ErrorBoundary(props: RenderableProps<{ onError?: (error: Error) => void }>): VNode;
