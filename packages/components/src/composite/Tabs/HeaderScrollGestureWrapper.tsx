import type { PropsWithChildren } from 'react';

import type { ICollapsibleTabContextType } from './CollapsibleTabContext';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

export interface IHeaderScrollGestureWrapperProps {
  disabled?: boolean;
  disableVerticalScroll?: boolean;
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
  excludeBottomEdgeHeight?: number;
  /** Reuse the originating tabs context when rendered through a portal. */
  tabsContextOverride?: ICollapsibleTabContextType;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
}

export function HeaderScrollGestureWrapper({
  children,
}: PropsWithChildren<IHeaderScrollGestureWrapperProps>) {
  return children;
}
