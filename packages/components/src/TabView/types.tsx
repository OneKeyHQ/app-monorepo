import type { TabWrapperProps } from './FreezeTab';
import type { Animated } from 'react-native';
import type { PagerViewProps } from 'react-native-pager-view';

export type Route = {
  key: string;
  title: string;
} & Omit<TabWrapperProps, 'route'>;

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
