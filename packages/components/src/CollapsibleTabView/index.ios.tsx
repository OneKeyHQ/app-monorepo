import type { ForwardRefRenderFunction } from 'react';
import { Children, Fragment, forwardRef } from 'react';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import type { TabProps } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';

import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

import type { CollapsibleContainerProps } from './types';

const Container: ForwardRefRenderFunction<
  ForwardRefHandle,
  CollapsibleContainerProps
> = (
  {
    disableRefresh,
    children,
    headerHeight,
    renderHeader,
    onIndexChange,
    initialTabName,
    onRefresh,
    refreshing,
    containerStyle,
    scrollEnabled = true,
    ...props
  },
  ref,
) => {
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

  return (
    <NestedTabView
      style={containerStyle}
      scrollEnabled={scrollEnabled}
      values={tabs}
      defaultIndex={selectedIndex}
      disableRefresh={disableRefresh}
      refresh={refreshing}
      spinnerColor={spinnerColor}
      onChange={(e) => {
        onIndexChange?.(e.nativeEvent.index);
      }}
      onRefreshCallBack={() => {
        setTimeout(() => {
          onRefresh?.();
        });
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
      ref={ref}
      {...props}
    >
      {children}
    </NestedTabView>
  );
};

export const Tabs = {
  Container: forwardRef(Container),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
  FlatList,
  ScrollView,
  SectionList,
};
