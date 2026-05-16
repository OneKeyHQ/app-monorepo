import type { PropsWithChildren } from 'react';

export interface IHeaderScrollGestureWrapperProps {
  disabled?: boolean;
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
  onGestureActiveChange?: (active: boolean) => void;
}

export function HeaderScrollGestureWrapper({
  children,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  return children;
}
