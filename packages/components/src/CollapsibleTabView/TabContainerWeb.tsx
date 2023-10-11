import type { ForwardRefRenderFunction, ReactNode } from 'react';
import {
  Children,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as React from 'react';

import { useWindowDimensions } from 'react-native';
import { TabBar, TabView } from 'react-native-tab-view';
import { ScrollView } from 'tamagui';

import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import { Stack } from '../Stack';

import { ActiveTabContext } from './ActiveTabContext';

import type { ForwardRefHandle } from './NativeNestedTabView/NestedTabView';
import type { CollapsibleContainerProps } from './types';
import type { StyleProp } from 'react-native';

type TabProps = {
  name: string;
  label: string;
};

const tabbarHeight = 48;

interface TabViewContentRef {
  setIndex: (newIndex: number) => void;
}

interface TabViewContentProps {
  initialTabName?: string;
  initialIndex: number;
  routes: { key: string; title: string }[];
  renderScene: ({ route }: any) => ReactNode;
  renderTabBar: (props: any) => React.ReactNode;
  onIndexChange?: (index: number) => void;
  shouldStickyTabBarWeb?: boolean;
}

function TabViewContent(
  {
    initialTabName,
    initialIndex,
    routes,
    renderScene,
    renderTabBar,
    onIndexChange,
    shouldStickyTabBarWeb,
  }: TabViewContentProps,
  ref: React.Ref<TabViewContentRef>,
) {
  const [index, setIndex] = useState(initialIndex);

  const handleChange = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);

      onIndexChange?.(newIndex);
    },
    [onIndexChange],
  );

  useImperativeHandle(ref, () => ({
    setIndex: (newIndex: number) => {
      setIndex(newIndex);
      onIndexChange?.(newIndex);
    },
  }));

  const contextValue = useMemo(
    () => ({ activeTabName: routes[index]?.key ?? initialTabName }),
    [routes, index, initialTabName],
  );

  return (
    <ActiveTabContext.Provider value={contextValue}>
      <TabView
        lazy
        animationEnabled={false}
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleChange}
        renderTabBar={renderTabBar}
        swipeEnabled={false}
        style={
          shouldStickyTabBarWeb
            ? {
                flex: 1,
                overflow: 'visible',
              }
            : undefined
        }
      />
    </ActiveTabContext.Provider>
  );
}

const TabContentView = memo(
  forwardRef<TabViewContentRef, TabViewContentProps>(TabViewContent),
);

const TabContainerWebView: ForwardRefRenderFunction<
  ForwardRefHandle,
  CollapsibleContainerProps
> = (
  {
    containerStyle,
    headerView,
    onIndexChange,
    initialTabName,
    scrollEnabled = true,
    stickyTabBar,
    children,
  },
  ref,
) => {
  const isVerticalLayout = useIsVerticalLayout();
  const shouldStickyTabBarWeb = useMemo(
    () => platformEnv.isRuntimeBrowser && isVerticalLayout && stickyTabBar,
    [isVerticalLayout, stickyTabBar],
  );
  const tabViewContentRef = useRef<TabViewContentRef | null>(null);

  const { routes, renderScene, initialIndex } = useMemo(() => {
    const routesArray: {
      key: string;
      title: string;
    }[] = [];
    const scene: Record<string, ReactNode> = {};

    // eslint-disable-next-line @typescript-eslint/no-shadow
    let initialIndex = 0;
    Children.forEach(children, (element, index) => {
      // @ts-expect-error
      const { name, label } = element.props as TabProps;
      if (initialTabName === name) {
        initialIndex = index;
      }
      routesArray.push({
        key: name,
        title: label,
      });
      scene[name] = element;
    });

    return {
      routes: routesArray,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      renderScene: ({ route }: any) => scene[route.key],
      initialIndex,
    };
  }, [children, initialTabName]);

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
          gap={isVerticalLayout ? 0 : 32}
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
      isVerticalLayout,
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

  const containerStyleMemo: StyleProp<any>[] = useMemo(
    () => [
      {
        backgroundColor: bgColor,
        flex: 1,
      },
      containerStyle,
    ],
    [bgColor, containerStyle],
  );

  return (
    <ScrollView style={containerStyleMemo} testID="Web-Tabs-ScrollView">
      {headerView}
      <TabContentView
        ref={tabViewContentRef}
        initialTabName={initialTabName}
        initialIndex={initialIndex}
        routes={routes}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        shouldStickyTabBarWeb={shouldStickyTabBarWeb}
        onIndexChange={onIndexChange}
      />
    </ScrollView>
  );
};

export const TabContainerWeb: typeof TabContainerWebView = TabContainerWebView;
TabContainerWeb.displayName = 'TabContainerWeb';
