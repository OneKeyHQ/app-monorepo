import type { PropsWithChildren } from 'react';

export interface IHeaderScrollGestureWrapperProps {
  onRefresh?: () => void;
}

export function HeaderScrollGestureWrapper({
  children,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  return children;
}
