import type { Animated } from 'react-native';
import type { PagerViewProps } from 'react-native-pager-view';
import type { TabWrapperProps } from '../CollapsibleTabView/FreezeTab';
import * as React from 'react';
import { FreezeTab } from '../CollapsibleTabView/FreezeTab';

export type Route = TabWrapperProps;

export type NavigationState<T extends Route> = {
  routes: T[];
};

export type SceneRendererProps = {
  position: Animated.AnimatedInterpolation<number>;
  jumpTo: (key: string) => void;
};

export type PagerProps = Omit<
  PagerViewProps,
  | 'initialPage'
  | 'scrollEnabled'
  | 'onPageScroll'
  | 'onPageSelected'
  | 'onPageScrollStateChanged'
  | 'keyboardDismissMode'
  | 'children'
> & {
  keyboardDismissMode?: 'none' | 'on-drag' | 'auto';
  swipeEnabled?: boolean;
  animationEnabled?: boolean;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
};
