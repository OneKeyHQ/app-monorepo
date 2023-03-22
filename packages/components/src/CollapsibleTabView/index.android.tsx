import type { ForwardRefRenderFunction } from 'react';
import { Children, Fragment, forwardRef } from 'react';

// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

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
    refreshing,
    renderHeader,
    children,
    onIndexChange,
    onRefresh,
    initialTabName,
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
    bgColor,
    bottomLineColor,
  ] = useThemeValue([
    'text-default',
    'text-subdued',
    'action-primary-default',
    'surface-default',
    'border-subdued',
  ]);

  return (
    <NestedTabView
      ref={ref}
      values={tabs}
      style={containerStyle}
      disableRefresh={disableRefresh}
      refresh={refreshing}
      defaultIndex={selectedIndex}
      tabViewStyle={{
        height: 54,
        indicatorColor,
        backgroundColor: bgColor,
        bottomLineColor,
        activeLabelColor,
        labelColor,
        labelStyle: Body2StrongProps,
      }}
      onRefreshCallBack={() => {
        setTimeout(() => {
          onRefresh?.();
        });
      }}
      renderHeader={renderHeader}
      onChange={(e) => {
        onIndexChange?.(e.nativeEvent.index);
      }}
      scrollEnabled={scrollEnabled}
      {...props}
    >
      {children}
    </NestedTabView>
  );
};

const renderScrollComponent = (props: any) => <NestedScrollView {...props} />;

export const Tabs = {
  Container: forwardRef(Container),
  // @ts-ignore to stop the warning about Fragment under development
  Tab: __DEV__ ? ({ children }) => <>{children}</> : Fragment,
  FlatList: ({ contentContainerStyle, ...props }: any) => (
    <FlatList
      contentContainerStyle={[contentContainerStyle, { minHeight: '100%' }]}
      {...props}
      renderScrollComponent={renderScrollComponent}
    />
  ),
  ScrollView,
  SectionList: ({ contentContainerStyle, ...props }: any) => (
    <SectionList
      contentContainerStyle={[contentContainerStyle, { minHeight: '100%' }]}
      {...props}
      renderScrollComponent={renderScrollComponent}
    />
  ),
};
