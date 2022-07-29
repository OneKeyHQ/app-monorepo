import { Children, FC, Fragment, ReactChild, ReactNode } from 'react';

// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NativeNestedTabView';
import { TabProps } from '@onekeyhq/app/src/views/NestedTabView/types';

import FlatList from '../FlatList';
import { useThemeValue } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import { Body2StrongProps } from '../Typography';

export type HomePageProps = {
  refresh?: boolean;
  disableRefresh?: boolean;
  headerHeight: number;
  renderHeader?: () => ReactNode | undefined;
  children: ReactChild;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
  onRefresh?: (refresh: boolean) => void;
};

// TODO: Compatible with the pad
const Container: FC<HomePageProps> = ({
  refresh,
  renderHeader,
  children,
  onTabChange,
  onIndexChange,
  onRefresh,
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
      style={{
        flex: 1,
      }}
      disableRefresh
      refresh={refresh}
      tabViewStyle={{
        height: 54,
        indicatorColor,
        backgroundColor: bgColor,
        bottomLineColor,
        activeLabelColor,
        labelColor,
        labelStyle: Body2StrongProps,
      }}
      onRefreshCallBack={(e) => {
        const currentRefresh = e.nativeEvent.refresh;
        setTimeout(() => {
          onRefresh?.(currentRefresh);
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
  Tab: Fragment,
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
