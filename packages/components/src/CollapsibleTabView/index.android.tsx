import { Children, FC, Fragment, ReactChild, ReactNode, useMemo } from 'react';

import { View } from 'native-base';
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
  headerHeight: number;
  renderHeader?: () => ReactNode | undefined;
  children: ReactChild;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
};

// TODO: Compatible with the pad
const Container: FC<HomePageProps> = ({
  renderHeader,
  children,
  onTabChange,
  onIndexChange,
  //   headerHeight,
  ...props
}) => {
  const tabs = Children.map(children, (child) =>
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    ({ name: child.props.name, label: child.props.label }),
  ) as TabProps[];

  const [tabbarBgColor, activeLabelColor, labelColor, indicatorColor] =
    useThemeValue([
      'surface-neutral-default',
      'text-default',
      'text-subdued',
      'surface-default',
    ]);

  return (
    <NestedTabView
      {...props}
      values={tabs}
      style={{
        flex: 1,
      }}
      tabViewStyle={{
        paddingX: 16,
        height: 36,
        activeColor: activeLabelColor,
        inactiveColor: labelColor,
        indicatorColor,
        backgroundColor: tabbarBgColor,
        labelStyle: Body2StrongProps,
      }}
      onChange={(e) => {
        console.log('===: NestedTabView onChange', e.nativeEvent);

        onTabChange?.({
          tabName: e.nativeEvent.tabName,
          index: e.nativeEvent.index,
        });
        onIndexChange?.(e.nativeEvent.index);
      }}
    >
      {renderHeader?.()}
      {Children.map(children, (child, index) => (
        <View key={index} collapsable={false} top={0}>
          {child}
        </View>
      ))}
    </NestedTabView>
  );
};

const renderScrollComponent = (props: any) => <NestedScrollView {...props} />;

export const Tabs = {
  Container,
  Tab: Fragment,
  FlatList: (props: any) => (
    <FlatList {...props} renderScrollComponent={renderScrollComponent} />
  ),
  ScrollView,
  SectionList: (props: any) => (
    <SectionList {...props} renderScrollComponent={renderScrollComponent} />
  ),
};
