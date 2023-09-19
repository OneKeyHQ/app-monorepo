import type { ComponentType, FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { TabView as RNTabView } from 'react-native-tab-view';

import { SceneMap, SegmentedControl } from '@onekeyhq/components';

import { useMarketSearchContainerStyle } from '../../hooks/useMarketSearch';

import type { Route as TabViewRoute } from 'react-native-tab-view';

export type SearchTabItem = {
  tabId: string;
  name: string;
  view: ComponentType<any>;
};
type Props = {
  navigationStateIndex: number;
  onTabChange?: (index: number) => void;
  options: SearchTabItem[];
};

const MarketSearchTabView: FC<Props> = ({
  navigationStateIndex,
  onTabChange,
  options,
}) => {
  const [index, setIndex] = useState(navigationStateIndex);
  const { bgColor } = useMarketSearchContainerStyle();
  const routes = useMemo(
    () =>
      options.map(
        (item): TabViewRoute => ({
          key: item.tabId,
        }),
      ),
    [options],
  );
  const renderScene = useMemo(() => {
    const scenes: {
      [key: string]: ComponentType<any>;
    } = {};
    options.forEach((item) => {
      scenes[item.tabId] = item.view;
    });
    return SceneMap(scenes);
  }, [options]);
  const onChange = useCallback(
    (tabIndex: number) => {
      setIndex(tabIndex);
      if (onTabChange) {
        onTabChange(tabIndex);
      }
    },
    [onTabChange],
  );
  return (
    <RNTabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      keyboardDismissMode="none"
      renderTabBar={() => (
        <SegmentedControl
          selectedIndex={index}
          onChange={onChange}
          values={options.map((item) => item.name)}
        />
      )}
      onIndexChange={onChange}
      style={{
        backgroundColor: bgColor,
      }}
    />
  );
};
export default MarketSearchTabView;
