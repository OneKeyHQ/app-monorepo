import React, { Children, FC, createContext } from 'react';

import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NestedTabView.ios';
import { TabProps } from '@onekeyhq/app/src/views/NestedTabView/types';

import FlatList from '../FlatList';
import { useThemeValue } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

const Context = createContext<string>('');

type ContainerProps = {
  headerHeight: number;
  initialTabName: string;
  renderHeader?: () => React.ReactNode;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
};
const Container: FC<ContainerProps> = ({
  children,
  headerHeight,
  renderHeader,
  onTabChange,
  onIndexChange,
  initialTabName,
}) => {
  const tabs = Children.map(children, (child) =>
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    ({ name: child.props.name, label: child.props.label }),
  ) as TabProps[];

  let selectedIndex = tabs.findIndex((tab) => tab.name === initialTabName);
  if (selectedIndex < 0) {
    selectedIndex = 0;
  }
  const [activeLabelColor, labelColor, indicatorColor, bottomLineColor] =
    useThemeValue([
      'text-default',
      'text-subdued',
      'action-primary-default',
      'border-subdued',
    ]);

  return (
    <Context.Provider value={tabs[selectedIndex].name}>
      <NestedTabView
        style={{ flex: 1 }}
        values={tabs}
        defaultIndex={selectedIndex}
        onChange={(e) => {
          onTabChange?.({
            tabName: e.nativeEvent.tabName,
            index: e.nativeEvent.index,
          });
          onIndexChange?.(e.nativeEvent.index);
        }}
        headerHeight={headerHeight}
        renderHeader={renderHeader}
        tabViewStyle={{
          paddingX: 0,
          height: 54,
          activeColor: activeLabelColor,
          inactiveColor: labelColor,
          indicatorColor,
          bottomLineColor,
          labelStyle: Body2StrongProps,
        }}
      >
        {children}
      </NestedTabView>
    </Context.Provider>
  );
};

export const Tabs = {
  Container,
  Tab: React.Fragment,
  FlatList,
  ScrollView,
  SectionList,
};
