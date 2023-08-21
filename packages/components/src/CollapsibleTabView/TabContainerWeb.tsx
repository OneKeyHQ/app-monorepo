import type { ForwardRefRenderFunction, ReactNode } from 'react';
import {
  Children,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { useWindowDimensions } from 'react-native';
import { TabBar, TabView } from 'react-native-tab-view';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';
import ScrollView from '../ScrollView';

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
    children,
    containerStyle,
    headerView,
    onIndexChange,
    initialTabName,
    scrollEnabled = true,
    stickyTabBar,
  },
  ref,
) => {
  const layout = useWindowDimensions();
  const isVerticalLayout = useIsVerticalLayout();
  const { routes, renderScene, initialIndex } = useMemo(() => {
    const routesArray: { key: string; title: string }[] = [];
    const scene: Record<string, ReactNode> = {};
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let initialIndex = 0;
    Children.forEach(children, (element, index) => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-shadow, @typescript-eslint/no-unsafe-member-access
      const { name, children, label } = element.props as TabProps;
      if (initialTabName === name) {
        initialIndex = index;
      }
      routesArray.push({
        key: name,
        title: label,
      });
      scene[name] = children;
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
    'text-default',
    'text-subdued',
    'action-primary-default',
    'divider',
    'border-subdued',
    'background-default',
  ]);

  useImperativeHandle(ref, () => ({
    setPageIndex: (pageIndex: number) => {
      setIndex(pageIndex);
    },
    setRefreshing: () => {},
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
        <Box
          testID="TabContainerWeb-TabBar-Box"
          maxW={MAX_PAGE_CONTAINER_WIDTH}
          px={{ sm: 8, lg: 4 }}
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
        </Box>
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

  return (
    <ScrollView style={[{ backgroundColor: bgColor }, containerStyle]}>
      {headerView}
      {tabViewContent}
    </ScrollView>
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
