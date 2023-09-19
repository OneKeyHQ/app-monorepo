import type { ComponentType, FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { TabView as RNTabView } from 'react-native-tab-view';

import {
  SceneMap,
  SegmentedControl,
  useThemeValue,
} from '@onekeyhq/components';

import type { Route as TabViewRoute } from 'react-native-tab-view';

export type ISendTokenTabViewItem = {
  label: string;
  title: string;
  view: ComponentType<any>;
};
type Props = {
  onIndexChange?: (index: number) => void;
  options: ISendTokenTabViewItem[];
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

  const renderTabBar = useCallback(
    () => (
      <SegmentedControl
        selectedIndex={index}
        onChange={setIndex}
        values={options.map((item) => item.title)}
      />
    ),
    [index, options],
  );

  const onIndexChangeInner = useCallback(
    (changeIndex: number) => {
      setIndex(changeIndex);
      if (onIndexChange) {
        onIndexChange(changeIndex);
      }
    },
    [onIndexChange],
  );

  const style = useMemo(
    () => ({
      backgroundColor: bgColor,
    }),
    [bgColor],
  );

  return (
    <RNTabView
      lazy
      navigationState={{ index, routes }}
      renderScene={renderScene}
      renderTabBar={renderTabBar}
      onIndexChange={onIndexChangeInner}
      style={style}
    />
  );
};
export { SceneMap } from 'react-native-tab-view';
export default memo(SendTokenTabView);
