import type { FC, ForwardRefRenderFunction, ReactNode } from 'react';
import {
  Children,
  Fragment,
  forwardRef,
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

import Box from '../Box';
import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

import type { CollapsibleContainerProps } from './types';

type TabProps = {
  name: string;
  label: string;
};

const tabbarHeight = 48;
const Container: ForwardRefRenderFunction<
  ForwardRefHandle,
  CollapsibleContainerProps
> = (
  {
    children,
    containerStyle,
    headerHeight,
    renderHeader,
    headerContainerStyle,
    onIndexChange,
    initialTabName,
    scrollEnabled = true,
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
  }));

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
        <Box maxW={MAX_PAGE_CONTAINER_WIDTH} px={{ sm: 8, lg: 4 }}>
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
      borderDefault,
      indicatorColor,
      indicatorContainerColor,
      isVerticalLayout,
      labelColor,
      layout.width,
      routes.length,
      scrollEnabled,
    ],
  );

  return (
    <ScrollView style={[{ backgroundColor: bgColor }, containerStyle]}>
      <Box h={headerHeight || 'auto'} style={headerContainerStyle}>
        {renderHeader?.()}
      </Box>
      <TabView
        lazy
        animationEnabled={false}
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleChange}
        initialLayout={layout}
        renderTabBar={renderTabBar}
        swipeEnabled={false}
      />
    </ScrollView>
  );
};

export const Tabs = {
  Container: forwardRef(Container),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: (__DEV__ ? ({ children }) => <>{children}</> : Fragment) as FC<TabProps>,
  FlatList,
  ScrollView,
  SectionList,
};

export * from './types';
