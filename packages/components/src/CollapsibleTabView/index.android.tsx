import type { FC } from 'react';
import { Children, Fragment } from 'react';

// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NativeNestedTabView';
import type { TabProps } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';

import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

import type { ContainerProps } from './types';

// TODO: Compatible with the pad
const Container: FC<ContainerProps> = ({
  disableRefresh,
  refreshing,
  renderHeader,
  children,
  onTabChange,
  onIndexChange,
  onRefresh,
  containerStyle,
  ...props
}) => {
  const tabs = Children.map(children, (child) =>
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    ({ name: child.props.name, label: child.props.label }),
  ) as TabProps[];

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
      {...props}
      values={tabs}
      style={containerStyle}
      disableRefresh={disableRefresh}
      refresh={refreshing}
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
        }, 0);
      }}
      onChange={(e) => {
        onTabChange?.({
          tabName: e.nativeEvent.tabName,
          index: e.nativeEvent.index,
        });
        onIndexChange?.(e.nativeEvent.index);
      }}
    >
      {renderHeader?.()}
      {children}
    </NestedTabView>
  );
};

const renderScrollComponent = (props: any) => <NestedScrollView {...props} />;

export const Tabs = {
  Container,
  // @ts-ignore to stop the warning about Fragment under development
  // eslint-disable-next-line no-undef
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
