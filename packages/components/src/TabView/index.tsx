import * as React from 'react';
import { forwardRef, memo } from 'react';

import ActiveTabProvider from './Provider/ActiveTabProvider';
import MultiTabView from './TabView';

import type { ForwardRefHandle } from './NativeTabView/NestedTabView';
import type {
  NavigationState,
  PagerProps,
  Route,
  SceneRendererProps,
} from './types';

export type Props<T extends Route> = PagerProps & {
  initialIndex?: number;
  onIndexChange: (index: number) => void;
  navigationState: NavigationState<T>;
  renderScene: (props: SceneRendererProps & { route: T }) => React.ReactNode;
  renderHeaderView?: () => React.ReactNode;
  renderLazyPlaceholder?: (props: { route: T }) => React.ReactNode;
  lazy?: ((props: { route: T }) => boolean) | boolean;

  // Native Only
  scrollEnabled?: boolean;
  onRefresh?: () => void;
  disableRefresh?: boolean;
};

function TabViewInner<T extends Route>(
  {
    initialIndex,
    onIndexChange,
    navigationState,
    renderScene,
    renderHeaderView,
    lazy = false,
    onSwipeStart,
    onSwipeEnd,
    renderLazyPlaceholder = () => null,
    onRefresh,
    scrollEnabled,
  }: Props<T>,
  ref: React.Ref<ForwardRefHandle>,
) {
  return (
    <ActiveTabProvider>
      <MultiTabView
        ref={ref}
        initialIndex={initialIndex}
        onIndexChange={onIndexChange}
        navigationState={navigationState}
        renderScene={renderScene}
        renderHeaderView={renderHeaderView}
        lazy={lazy}
        onSwipeStart={onSwipeStart}
        onSwipeEnd={onSwipeEnd}
        renderLazyPlaceholder={renderLazyPlaceholder}
        onRefresh={onRefresh}
        scrollEnabled={scrollEnabled}
      />
    </ActiveTabProvider>
  );
}

export const TabView = memo(
  forwardRef<ForwardRefHandle, Props<Route>>(TabViewInner),
);
