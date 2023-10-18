import type { ForwardRefRenderFunction, ReactNode } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import * as React from 'react';

import { TabBar, TabView } from 'react-native-tab-view';
import { ScrollView } from 'tamagui';

import { getThemeTokens, useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import { Stack } from '../Stack';

import { useActiveTabContext } from './Provider/ActiveTabContext';

import type { Props } from './index';
import type { ForwardRefHandle } from './NativeTabView/NestedTabView';
import type { Route } from './types';
import type { StyleProp } from 'react-native';

const tabbarHeight = 48;

interface TabViewContentRef {
  setIndex: (newIndex: number) => void;
}

interface TabViewContentProps {
  lazy?: ((props: { route: Route }) => boolean) | boolean;
  initialIndex: number;
  routes: { key: string; title: string }[];
  renderScene: ({ route }: any) => ReactNode;
  renderTabBar: (props: any) => React.ReactNode;
  onIndexChange?: (index: number) => void;
  shouldStickyTabBarWeb?: boolean;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  renderLazyPlaceholder?: (props: { route: Route }) => React.ReactNode;
  swipeEnabled?: boolean;
}

function TabViewContent(
  {
    initialIndex = 0,
    routes,
    renderScene,
    renderTabBar,
    onIndexChange,
    shouldStickyTabBarWeb,
    onSwipeStart,
    onSwipeEnd,
    swipeEnabled = false,
  }: TabViewContentProps,
  ref: React.Ref<TabViewContentRef>,
) {
  const { activeTabKey, setActiveTabKey } = useActiveTabContext();

  if (!activeTabKey) {
    setImmediate(() => {
      setActiveTabKey?.(routes[initialIndex]?.key);
    });
  }

  const indexMemo = useMemo(() => {
    const index = routes.findIndex((route) => route.key === activeTabKey);
    if (index !== -1) {
      return index;
    }
    setActiveTabKey?.(routes[initialIndex]?.key);
    return initialIndex;
  }, [routes, setActiveTabKey, initialIndex, activeTabKey]);

  const onIndexChangeCall = useCallback(
    (newIndex: number) => {
      setActiveTabKey?.(routes[newIndex]?.key);
      onIndexChange?.(newIndex);
    },
    [onIndexChange, routes, setActiveTabKey],
  );

  useImperativeHandle(ref, () => ({
    setIndex: (newIndex: number) => {
      setActiveTabKey?.(routes[newIndex]?.key);
    },
  }));

  if (!activeTabKey) {
    return null;
  }

  return (
    <TabView
      onSwipeStart={onSwipeStart}
      onSwipeEnd={onSwipeEnd}
      swipeEnabled={swipeEnabled}
      animationEnabled={false}
      navigationState={{ index: indexMemo, routes }}
      renderScene={renderScene}
      onIndexChange={onIndexChangeCall}
      renderTabBar={renderTabBar}
      style={
        shouldStickyTabBarWeb
          ? {
              flex: 1,
              overflow: 'visible',
            }
          : undefined
      }
    />
  );
}

const TabContentView = memo(
  forwardRef<TabViewContentRef, TabViewContentProps>(TabViewContent),
);

const TabContainerView: ForwardRefRenderFunction<
  ForwardRefHandle,
  Props<Route>
> = (
  {
    initialIndex = 0,
    onIndexChange,
    navigationState,
    renderScene,
    renderHeaderView = () => null,
    onSwipeStart,
    onSwipeEnd,
    renderLazyPlaceholder,
    scrollEnabled,
  },
  ref,
) => {
  const shouldStickyTabBarWeb = useMemo(() => platformEnv.isRuntimeBrowser, []);
  const tabViewContentRef = useRef<TabViewContentRef | null>(null);

  const { routes } = navigationState;

  const itemPaddingX = getThemeTokens().size['8'].val;

  const [
    activeLabelColor,
    labelColor,
    indicatorColor,
    indicatorContainerColor,
    borderDefault,
    bgColor,
  ] = useThemeValue([
    'text',
    'textSubdued',
    'bgPrimary',
    'bgApp',
    'borderSubdued',
    'bg',
  ]);

  useImperativeHandle(ref, () => ({
    setPageIndex: (pageIndex: number) => {
      tabViewContentRef?.current?.setIndex?.(pageIndex);
    },
    setRefreshing: () => {},
    setHeaderHeight: () => {},
  }));

  const tabbarStyle = useMemo(
    () => ({
      tabbar: {
        backgroundColor: 'transparent',
        flex: 1,
        height: tabbarHeight,
        borderBottomWidth: 0,
        borderBottomColor: borderDefault,
        shadowOffset: null,
      },
      indicator: {
        backgroundColor: indicatorColor,
        height: 2,
      },
      indicatorContainer: {
        height: 1,
        top: tabbarHeight - 1,
        width: '100%',
        backgroundColor: indicatorContainerColor,
      },
      tabStyle: {
        width: 'auto',
        paddingHorizontal: 0,
      },
      label: {
        fontWeight: '500',
        fontSize: 16,
        lineHeight: 24,
      },
    }),
    [borderDefault, indicatorColor, indicatorContainerColor],
  );

  const renderTabBar = useCallback(
    (props: any) => (
      <Stack
        testID="TabContainerWeb-TabBar-Box"
        paddingHorizontal="$5"
        style={
          shouldStickyTabBarWeb
            ? ({
                position: 'sticky',
                top: 0,
                zIndex: 1,
                backgroundColor: bgColor,
              } as any)
            : undefined
        }
      >
        <TabBar
          {...props}
          lazy
          gap={itemPaddingX}
          scrollEnabled={scrollEnabled}
          indicatorStyle={tabbarStyle.indicator}
          indicatorContainerStyle={tabbarStyle.indicatorContainer}
          style={tabbarStyle.tabbar}
          tabStyle={tabbarStyle.tabStyle}
          activeColor={activeLabelColor}
          inactiveColor={labelColor}
          labelStyle={tabbarStyle.label}
          getLabelText={({ route }) => route.title}
          getAccessibilityLabel={({ route }) => route.title}
        />
      </Stack>
    ),
    [
      activeLabelColor,
      bgColor,
      itemPaddingX,
      labelColor,
      scrollEnabled,
      shouldStickyTabBarWeb,
      tabbarStyle.indicator,
      tabbarStyle.indicatorContainer,
      tabbarStyle.label,
      tabbarStyle.tabStyle,
      tabbarStyle.tabbar,
    ],
  );

  const containerStyleMemo: StyleProp<any> = useMemo(
    () => ({
      backgroundColor: bgColor,
      flex: 1,
    }),
    [bgColor],
  );

  const headerView = useMemo(() => renderHeaderView?.(), [renderHeaderView]);

  return (
    <ScrollView style={containerStyleMemo} testID="Web-TabView-Tabs-ScrollView">
      {headerView}
      <TabContentView
        lazy={false}
        initialIndex={initialIndex}
        ref={tabViewContentRef}
        routes={routes}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        shouldStickyTabBarWeb={shouldStickyTabBarWeb}
        onIndexChange={onIndexChange}
        onSwipeEnd={onSwipeEnd}
        onSwipeStart={onSwipeStart}
        swipeEnabled
        renderLazyPlaceholder={renderLazyPlaceholder}
      />
    </ScrollView>
  );
};

export default forwardRef<ForwardRefHandle, Props<any>>(TabContainerView);
TabContainerView.displayName = 'TabContainerWeb';
