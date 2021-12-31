import React, { ReactNode, useState } from 'react';

import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  NavigationState,
  Route,
  SceneRendererProps,
  TabBar,
} from 'react-native-tab-view';
import {
  CollapsibleHeaderTabView as ZHeaderTabView,
  ZTabViewProps,
} from 'react-native-tab-view-collapsible-header';

import Box from '../Box';
import { useThemeValue } from '../Provider/hooks';

export type HeaderTabViewProps<T extends Route> = {
  renderScrollHeader: ZTabViewProps<T>['renderScrollHeader'];
  autoWidth?: boolean;
  paddingX?: number;
  onIndexChange?: (index: number) => void;
  routes: T[];
  renderScene: (
    props: SceneRendererProps & {
      route: Route;
    },
  ) => ReactNode;
  sceneRefreshEnabled?: boolean;
  tabsRefreshEnabled?: boolean;
};

const HeaderTabViewContainer = <T extends Route>({
  routes,
  paddingX = 0,
  autoWidth = false,
  renderScene,
  onIndexChange,
  tabsRefreshEnabled,
  ...rest
}: HeaderTabViewProps<T>) => {
  const [index, setIndex] = useState(0);
  const layout = useWindowDimensions();
  const tabWidth = (layout.width - paddingX * 2) / routes.length;
  const bgColor = useThemeValue('background-default');
  const dividerColor = useThemeValue('border-subdued');
  const indicatorColor = useThemeValue('action-primary-default');
  const activeColor = useThemeValue('text-default');
  const inactiveColor = useThemeValue('text-subdued');

  const renderTabBar = (
    props: SceneRendererProps & { navigationState: NavigationState<Route> },
  ) => {
    const tabbarHeight = 54;

    const styles = StyleSheet.create({
      tabbar: {
        backgroundColor: bgColor,
        width: layout.width,
        height: tabbarHeight,
      },
      indicator: {
        backgroundColor: indicatorColor,
        height: 2,
      },
      indicatorContainer: {
        backgroundColor: dividerColor,
        height: 1,
        top: tabbarHeight - 2,
        left: paddingX,
        right: paddingX,
        width: layout.width - paddingX * 2,
      },
      tabStyle: {
        width: autoWidth ? 'auto' : tabWidth,
        left: paddingX,
        right: paddingX,
      },
      label: {
        fontFamily: 'PlusJakartaSans-Medium',
        fontWeight: '600',
        fontSize: 14,
        lineHeight: 20,
        textTransform: 'capitalize',
      },
    });

    return (
      <Box>
        <TabBar
          {...props}
          scrollEnabled
          indicatorStyle={styles.indicator}
          indicatorContainerStyle={styles.indicatorContainer}
          style={styles.tabbar}
          tabStyle={styles.tabStyle}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
          labelStyle={styles.label}
          getLabelText={({ route }) => route.title}
          getAccessibilityLabel={({ route }) => route.title}
        />
      </Box>
    );
  };

  return (
    <ZHeaderTabView
      {...rest}
      renderTabBar={renderTabBar}
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={(changeIndex: number) => {
        setIndex(changeIndex);
        if (onIndexChange) {
          onIndexChange(changeIndex);
        }
      }}
      initialLayout={{ width: layout.width }}
      sceneContainerStyle={false}
      onStartRefresh={undefined}
    />
  );
};

export default HeaderTabViewContainer;
