import type { FC } from 'react';
import { Children, Fragment, createContext } from 'react';

import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import type { TabProps } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';

import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

import type { CollapsibleContainerProps } from './types';

const Context = createContext<string>('');

const Container: FC<CollapsibleContainerProps> = ({
  disableRefresh,
  children,
  headerHeight,
  renderHeader,
  onTabChange,
  onIndexChange,
  initialTabName,
  onRefresh,
  refreshing,
  containerStyle,
  scrollEnabled = true,
  // ref,
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
  const [
    activeLabelColor,
    labelColor,
    indicatorColor,
    bottomLineColor,
    spinnerColor,
  ] = useThemeValue([
    'text-default',
    'text-subdued',
    'action-primary-default',
    'border-subdued',
    'text-default',
  ]);

  // const iosRef = useRef<NestedTabView>(null);
  return (
    <Context.Provider value={tabs[selectedIndex].name}>
      <NestedTabView
        // ref={iosRef}
        style={containerStyle}
        scrollEnabled={scrollEnabled}
        values={tabs}
        defaultIndex={selectedIndex}
        disableRefresh={disableRefresh}
        refresh={refreshing}
        spinnerColor={spinnerColor}
        onChange={(e) => {
          onTabChange?.({
            tabName: e.nativeEvent.tabName,
            index: e.nativeEvent.index,
          });
          onIndexChange?.(e.nativeEvent.index);
        }}
        onRefreshCallBack={() => {
          setTimeout(() => {
            onRefresh?.();
          }, 0);
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
  // @ts-ignore to stop the warning about Fragment under development
  // eslint-disable-next-line no-undef
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
  FlatList,
  ScrollView,
  SectionList,
};
