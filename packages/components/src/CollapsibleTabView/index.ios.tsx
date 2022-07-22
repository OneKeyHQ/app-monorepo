import React, {
  Children,
  ComponentProps,
  FC,
  createContext,
  useRef,
  useState,
} from 'react';

import {
  Container as BaseContainer,
  MaterialTabBar,
} from 'react-native-collapsible-tab-view';

import NativePagingView from '@onekeyhq/app/src/views/PagingView';
import { TabProps } from '@onekeyhq/app/src/views/types';

import FlatList from '../FlatList';
import { useThemeValue } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

export { MaterialTabBar };

const Context = createContext<string>('');

type ContainerProps = ComponentProps<typeof BaseContainer> & {
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
  const tabs: TabProps[] = Children.map(children, (child) =>
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    ({ name: child.props.name, label: child.props.label }),
  );

  let selectedIndex = tabs.findIndex((tab) => tab.name === initialTabName);
  if (selectedIndex < 0) {
    selectedIndex = 0;
  }
  const ref = useRef<NativePagingView>(null);
  const [tabbarBgColor, activeLabelColor, labelColor, indicatorColor] =
    useThemeValue([
      'surface-neutral-default',
      'text-default',
      'text-subdued',
      'surface-default',
    ]);

  return (
    <NativePagingView
      ref={ref}
      style={{ flex: 1 }}
      values={tabs}
      defaultIndex={selectedIndex}
      onChange={(e) => {
        if (onTabChange) {
          onTabChange({
            tabName: e.nativeEvent.tabName,
            index: e.nativeEvent.index,
          });
        }
      }}
      headerHeight={headerHeight}
      // @ts-ignore
      renderHeader={renderHeader}
      tabViewStyle={{
        paddingX: 16,
        height: 36,
        activeColor: activeLabelColor,
        inactiveColor: labelColor,
        indicatorColor,
        backgroundColor: tabbarBgColor,
        labelStyle: Body2StrongProps,
      }}
    >
      <Context.Provider value={tabs[selectedIndex].name}>
        {children}
      </Context.Provider>
    </NativePagingView>
  );
};

export const Tabs = {
  Container,
  Tab: React.Fragment,
  FlatList,
  ScrollView,
  SectionList,
};
