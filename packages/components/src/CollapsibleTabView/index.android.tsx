import type { FC } from 'react';
import { Children, Fragment } from 'react';

// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import type { TabProps } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';

import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

import type { CollapsibleContainerProps } from './types';

const Container: FC<CollapsibleContainerProps> = ({
  disableRefresh,
  refreshing,
  renderHeader,
  children,
  onIndexChange,
  onRefresh,
  containerStyle,
  scrollEnabled = true,
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
  Container,
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
