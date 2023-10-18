import type { ForwardRefRenderFunction, ReactNode } from 'react';
import { forwardRef, memo, useCallback, useEffect, useMemo } from 'react';
import * as React from 'react';

import type { Props } from '@onekeyhq/components';
import { getThemeTokens, useThemeValue } from '@onekeyhq/components';
import PlatformEnv from '@onekeyhq/shared/src/platformEnv';

import NestedTabView from './NativeTabView/NestedTabView';
import { useActiveTabContext } from './Provider/ActiveTabContext';

import type { ForwardRefHandle } from './NativeTabView/NestedTabView';
import type {
  OnPageChangeEvent,
  OnPageScrollStateChangeEvent,
  TabViewStyle,
} from './NativeTabView/types';
import type { Route } from './types';
import type { StyleProp, ViewStyle } from 'react-native';

interface TabViewContentProps {
  routes: Route[];
  renderScene: ({ route }: any) => ReactNode;
  renderHeaderView: () => ReactNode;
  scrollEnabled?: boolean;
  onPageChange?: (e: OnPageChangeEvent) => void;
  onPageScrollStateChange?: (e: OnPageScrollStateChangeEvent) => void;
  disableRefresh?: boolean;
  onRefresh?: () => void;
}

function TabViewContent(
  {
    routes,
    renderScene,
    renderHeaderView,
    onPageChange,
    onPageScrollStateChange,
    scrollEnabled,
    onRefresh,
    disableRefresh,
  }: TabViewContentProps,
  ref: React.Ref<ForwardRefHandle>,
) {
  const [activeLabelColor, labelColor, indicatorColor, bgColor, spinnerColor] =
    useThemeValue(['text', 'textSubdued', 'bgPrimary', 'bgApp', 'iconActive']);

  const tabViewStyle: TabViewStyle = useMemo(() => {
    const itemPaddingY = getThemeTokens().size['3.5'].val;
    const itemPaddingX = getThemeTokens().size['5'].val;

    return {
      height: 54,
      activeLabelColor,
      labelColor,
      indicatorColor,
      itemPaddingX,
      itemPaddingY,
      backgroundColor: bgColor,
      tabSpaceEqual: false,
      labelStyle: { fontWeight: '500', fontSize: 16, lineHeight: 24 },
    };
  }, [activeLabelColor, bgColor, indicatorColor, labelColor]);

  const newContainerStyle: StyleProp<ViewStyle> = useMemo(
    () => ({
      flex: 1,
    }),
    [],
  );

  const onRefreshCallBack = useCallback(() => {
    setTimeout(() => {
      onRefresh?.();
    });
  }, [onRefresh]);

  return (
    <NestedTabView
      ref={ref}
      routes={routes}
      style={newContainerStyle}
      disableRefresh={disableRefresh}
      spinnerColor={spinnerColor}
      tabViewStyle={tabViewStyle}
      onRefreshCallBack={onRefreshCallBack}
      renderScene={renderScene}
      renderHeaderView={renderHeaderView}
      onPageChange={onPageChange}
      scrollEnabled={scrollEnabled}
      onPageScrollStateChange={onPageScrollStateChange}
    />
  );
}

const TabContentView = memo(
  forwardRef<ForwardRefHandle, TabViewContentProps>(TabViewContent),
);

const TabContainerNativeView: ForwardRefRenderFunction<
  ForwardRefHandle,
  Props<Route>
> = (
  {
    disableRefresh,
    onRefresh,
    onIndexChange,
    navigationState,
    renderScene,
    renderHeaderView = () => null,
    onSwipeStart,
    onSwipeEnd,
    scrollEnabled,
  },
  ref,
) => {
  const { routes } = navigationState;
  const { activeTabKey, setActiveTabKey } = useActiveTabContext();

  useEffect(() => {
    if (PlatformEnv.isNativeIOS && !activeTabKey) {
      setActiveTabKey?.(routes[0]?.key);
    }
    // only run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPageChange = useCallback(
    (e: OnPageChangeEvent) => {
      onIndexChange?.(e.nativeEvent?.index);
      setActiveTabKey?.(routes[e.nativeEvent?.index]?.key);
    },
    [onIndexChange, routes, setActiveTabKey],
  );

  const onPageScrollStateChange = useCallback(
    (e: OnPageScrollStateChangeEvent) => {
      if (e.nativeEvent?.state === 'dragging') {
        onSwipeStart?.();
      } else if (e.nativeEvent?.state === 'idle') {
        onSwipeEnd?.();
      }
    },
    [onSwipeEnd, onSwipeStart],
  );

  return (
    <TabContentView
      routes={routes}
      onRefresh={onRefresh}
      onPageChange={onPageChange}
      onPageScrollStateChange={onPageScrollStateChange}
      disableRefresh={disableRefresh}
      renderHeaderView={renderHeaderView}
      scrollEnabled={scrollEnabled}
      renderScene={renderScene}
      ref={ref}
    />
  );
};

export default memo(
  forwardRef<ForwardRefHandle, Props<any>>(TabContainerNativeView),
);
