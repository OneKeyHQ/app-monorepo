import type { ComponentType, FC } from 'react';
import { useMemo, useState } from 'react';

import { TabView as RNTabView } from 'react-native-tab-view';

import {
  SceneMap,
  SegmentedControl,
  useThemeValue,
} from '@onekeyhq/components';

import type { Route as TabViewRoute } from 'react-native-tab-view';

type TabViewItem = {
  label: string;
  title: string;
  view: ComponentType<any>;
};
type Props = {
  onIndexChange?: (index: number) => void;
  options: TabViewItem[];
};

const SendTokenTabView: FC<Props> = ({ onIndexChange, options }) => {
  const [index, setIndex] = useState(0);
  const bgColor = useThemeValue('background-default');
  const routes = useMemo(
    () =>
      options.map(
        (item): TabViewRoute => ({
          key: item.label,
        }),
      ),
    [options],
  );
  const renderScene = useMemo(() => {
    const scenes: {
      [key: string]: ComponentType<any>;
    } = {};
    options.forEach((item) => {
      scenes[item.label] = item.view;
    });
    return SceneMap(scenes);
  }, [options]);

  return (
    <RNTabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      renderTabBar={() => (
        <SegmentedControl
          selectedIndex={index}
          onChange={setIndex}
          values={options.map((item) => item.title)}
        />
      )}
      onIndexChange={(changeIndex: number) => {
        setIndex(changeIndex);
        if (onIndexChange) {
          onIndexChange(changeIndex);
        }
      }}
      style={{
        backgroundColor: bgColor,
      }}
    />
  );
};
export { SceneMap } from 'react-native-tab-view';
export default SendTokenTabView;
