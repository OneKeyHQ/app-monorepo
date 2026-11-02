import type { PropsWithChildren } from 'react';

// The collapsible pager forwards header gestures to its active native scroller.
export function HomeHeaderGesture({
  children,
}: PropsWithChildren<{ onRefresh?: () => void }>) {
  return children;
}
