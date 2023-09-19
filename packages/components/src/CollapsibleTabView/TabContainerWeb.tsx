import type { ForwardRefRenderFunction, ReactNode } from 'react';
import {
  Children,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { ScrollView, useWindowDimensions } from 'react-native';
import { TabBar, TabView } from 'react-native-tab-view';

import { useThemeValue } from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useIsVerticalLayout from '../Provider/hooks/useIsVerticalLayout';
import { Stack } from '../Stack';

import { ActiveTabContext } from './ActiveTabContext';

import type { ForwardRefHandle } from './NativeNestedTabView/NestedTabView';
import type { CollapsibleContainerProps } from './types';

type TabProps = {
  name: string;
  label: string;
};

const tabbarHeight = 48;
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
  const layout = useWindowDimensions();
  const isVerticalLayout = useIsVerticalLayout();
  const { routes, renderScene, initialIndex } = useMemo(() => {
    const routesArray: {
      key: string;
      title: string;
    }[] = [];
    const scene: Record<string, ReactNode> = {};
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let initialIndex = 0;
    Children.forEach(children, (element, index) => {
      // @ts-ignore
      const { name, children: child, label } = element.props as TabProps;
      if (initialTabName === name) {
        initialIndex = index;
      }
      routesArray.push({
        key: name,
        title: label,
      });
      scene[name] = child;
    });
    return {
      routes: routesArray,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      renderScene: ({ route }: any) => scene[route.key],
      initialIndex,
    };
  }, [children, initialTabName]);
  const [index, setIndex] = useState(initialIndex);

  const handleChange = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);

      onIndexChange?.(newIndex);
    },
    [onIndexChange],
  );
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
    'iconActive',
    'divider',
    'borderSubdued',
    'bg',
  ]);

  useImperativeHandle(ref, () => ({
    setPageIndex: (pageIndex: number) => {
      setIndex(pageIndex);
    },
    setRefreshing: () => {},
    setHeaderHeight: () => {},
  }));

  const shouldStickyTabbarWeb = useMemo(
    () => platformEnv.isRuntimeBrowser && isVerticalLayout && stickyTabBar,
    [isVerticalLayout, stickyTabBar],
  );

  const renderTabBar = useCallback(
    (props: any) => {
      const tabContainerWidth = isVerticalLayout
        ? layout.width
        : Math.min(MAX_PAGE_CONTAINER_WIDTH, layout.width - 224 - 32 * 2);
      const styles = {
        tabbar: {
          backgroundColor: 'transparent',
          flex: 1,
          height: tabbarHeight,
          borderBottomWidth: 0,
          borderBottomColor: borderDefault,
          shadowOffset: null,
          // marginHorizontal,
          // width: tabContainerWidth,
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
          width: isVerticalLayout ? tabContainerWidth / routes.length : 'auto',
          // minWidth: isVerticalLayout ? undefined : 90,
          paddingHorizontal: 0,
        },
        label: {
          fontWeight: '500',
          fontSize: 14,
          lineHeight: 20,
        },
      };
      return (
        <Stack
          testID="TabContainerWeb-TabBar-Box"
          maxWidth={MAX_PAGE_CONTAINER_WIDTH}
          $xs={{
            paddingHorizontal: '$2',
          }}
          $lg={{
            paddingHorizontal: '$1',
          }}
          style={
            shouldStickyTabbarWeb
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
            indicatorStyle={styles.indicator}
            indicatorContainerStyle={styles.indicatorContainer}
            style={styles.tabbar}
            tabStyle={styles.tabStyle}
            activeColor={activeLabelColor}
            inactiveColor={labelColor}
            labelStyle={styles.label}
            getLabelText={({ route }) => route.title}
            getAccessibilityLabel={({ route }) => route.title}
          />
        </Stack>
      );
    },
    [
      activeLabelColor,
      bgColor,
      borderDefault,
      indicatorColor,
      indicatorContainerColor,
      isVerticalLayout,
      labelColor,
      layout.width,
      routes.length,
      scrollEnabled,
      shouldStickyTabbarWeb,
    ],
  );

  const tabViewContent = useMemo(
    () => (
      <TabView
        lazy
        animationEnabled={false}
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleChange}
        initialLayout={layout}
        renderTabBar={renderTabBar}
        swipeEnabled={false}
        style={
          shouldStickyTabbarWeb
            ? {
                flex: 1,
                overflow: 'visible',
              }
            : undefined
        }
      />
    ),
    [
      handleChange,
      index,
      layout,
      renderScene,
      renderTabBar,
      routes,
      shouldStickyTabbarWeb,
    ],
  );

  const contextValue = useMemo(
    () => ({ activeTabName: routes[index]?.key ?? initialTabName }),
    [routes, index, initialTabName],
  );

  return (
    <ActiveTabContext.Provider value={contextValue}>
      <ScrollView style={[{ backgroundColor: bgColor }, containerStyle]}>
        {headerView}
        {tabViewContent}
      </ScrollView>
    </ActiveTabContext.Provider>
  );
};

export const TabContainerWeb: typeof TabContainerWebView = TabContainerWebView;
/*
Component is not a function
TypeError: Component is not a function
    at renderWithHooks (http://localhost:3000/static/js/42.chunk.js:17384:18)
    at updateForwardRef 
*/
// export const TabContainerWeb: typeof TabContainerWebView = memo(
// forwardRef(TabContainerWebView),
// );
