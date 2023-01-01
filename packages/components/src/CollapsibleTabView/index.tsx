import type { FC } from 'react';
import { Children, useCallback, useMemo, useState } from 'react';

import { useWindowDimensions } from 'react-native';
import { SceneMap, TabBar, TabView } from 'react-native-tab-view';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';

import Box from '../Box';
import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';

import type { CollapsibleContainerProps } from './types';

type TabProps = {
  name: string;
  label: string;
};

const Container: FC<CollapsibleContainerProps> = ({
  children,
  containerStyle,
  headerHeight,
  renderHeader,
  headerContainerStyle,
  onTabChange,
  onIndexChange,
  initialTabName,
}) => {
  const layout = useWindowDimensions();
  const isVerticalLayout = useIsVerticalLayout();
  const { routes, renderScene, initialIndex } = useMemo(() => {
    const routesArray: { key: string; title: string }[] = [];
    const scene = {};
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let initialIndex = 0;
    Children.forEach(children, (element, index) => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const { name, children, label } = element.props as TabProps;
      if (initialTabName === name) {
        initialIndex = index;
      }
      routesArray.push({
        key: name,
        title: label,
      });
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      scene[name] = () => children;
    });
    return { routes: routesArray, renderScene: SceneMap(scene), initialIndex };
  }, [children, initialTabName]);
  const [index, setIndex] = useState(initialIndex);

  const handleChange = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);

      if (onTabChange) {
        onTabChange({
          index: newIndex,
          tabName: routes[newIndex].key,
        });
      }
      if (onIndexChange) {
        onIndexChange(newIndex);
      }
    },
    [onIndexChange, onTabChange, routes],
  );
  const [activeLabelColor, labelColor, indicatorColor] = useThemeValue([
    'text-default',
    'text-subdued',
    'action-primary-default',
  ]);

  const renderTabBar = useCallback(
    (props: any) => {
      const tabbarHeight = 48;

      const styles = {
        tabbar: {
          backgroundColor: 'transparent',
          width: '100%',
          height: tabbarHeight,
        },
        indicator: {
          backgroundColor: indicatorColor,
          height: 2,
        },
        indicatorContainer: {
          height: 2,
          top: tabbarHeight - 2,
          width: '100%',
        },
        tabStyle: {
          width: isVerticalLayout ? layout.width / routes.length : 'auto',
          minWidth: isVerticalLayout ? undefined : 90,
        },
        label: {
          fontWeight: '500',
          fontSize: 14,
          lineHeight: 20,
          fontFamily: 'BlinkMacSystemFont',
        },
      };
      return (
        <TabBar
          {...props}
          scrollEnabled
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
      );
    },
    [
      activeLabelColor,
      indicatorColor,
      isVerticalLayout,
      labelColor,
      layout.width,
      routes.length,
    ],
  );

  return (
    <ScrollView style={containerStyle}>
      <Box h={headerHeight || 'auto'} style={headerContainerStyle}>
        {renderHeader?.()}
      </Box>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleChange}
        initialLayout={{ width: layout.width }}
        renderTabBar={renderTabBar}
      />
    </ScrollView>
  );
};

export const Tabs = {
  Container,
  // @ts-ignore to stop the warning about Fragment under development
  // eslint-disable-next-line no-undef
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
  FlatList,
  ScrollView,
  SectionList,
};

export * from './types';
