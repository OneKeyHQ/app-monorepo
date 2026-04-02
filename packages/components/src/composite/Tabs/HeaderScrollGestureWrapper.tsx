import type { PropsWithChildren } from 'react';

export interface IHeaderScrollGestureWrapperProps {
  onRefresh?: () => void;
  disableMomentum?: boolean;
  panActiveOffsetY?: [number, number];
  panFailOffsetX?: [number, number];
  excludeRightEdgeRatio?: number;
  scrollScale?: number;
  onHorizontalSwipe?: (direction: 'left' | 'right') => void;
  horizontalSwipeThreshold?: number;
  horizontalSwipeVelocityThreshold?: number;
  simultaneousWithNativeGesture?: boolean;
  cancelChildTouches?: boolean;
}

export function HeaderScrollGestureWrapper({
  children,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  return children;
}
