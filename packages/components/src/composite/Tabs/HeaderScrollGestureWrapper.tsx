import type { PropsWithChildren } from 'react';

export interface IHeaderScrollGestureWrapperProps {
  disabled?: boolean;
  disableVerticalScroll?: boolean;
  onRefresh?: () => void;
  disableMomentum?: boolean;
  panActiveOffsetY?: [number, number];
  panFailOffsetX?: [number, number];
  // Initial vertical speed in points/second; slower drags yield to children.
  verticalPanMinVelocity?: number;
  verticalPanMaxPointers?: number;
  excludeRightEdgeRatio?: number;
  scrollScale?: number;
  onHorizontalSwipe?: (direction: 'left' | 'right') => void;
  horizontalSwipeThreshold?: number;
  horizontalSwipeVelocityThreshold?: number;
  simultaneousWithNativeGesture?: boolean;
  cancelChildTouches?: boolean;
  onGestureActiveChange?: (active: boolean) => void;
  excludeBottomEdgeHeight?: number;
}

export function HeaderScrollGestureWrapper({
  children,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  return children;
}
