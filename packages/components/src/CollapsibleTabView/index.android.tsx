import {
  Children,
  FC,
  Fragment,
  ReactChild,
  ReactNode,
  createContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { View, useWindowDimensions } from 'react-native';
// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';
import PagerView from 'react-native-pager-view';

import NestedTabView from '@onekeyhq/app/src/views/NestedTabView';
import { useIsVerticalLayout } from '@onekeyhq/components';
import {
  FIXED_HORIZONTAL_HEDER_HEIGHT,
  FIXED_VERTICAL_HEADER_HEIGHT,
} from '@onekeyhq/kit/src/views/Wallet/AccountInfo';

import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import SegmentedControl from '../SegmentedControl';

export type HomePageProps = {
  headerHeight: number;
  renderHeader?: () => ReactNode | undefined;
  children: ReactChild;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
};

const Context = createContext<string>('');

// TODO: Compatible with the pad
const Container: FC<HomePageProps> = ({
  renderHeader,
  children,
  onTabChange,
  onIndexChange,
  //   headerHeight,
  ...props
}) => {
  const dimensions = useWindowDimensions();
  const isVerticalLayout = useIsVerticalLayout();

  const height = useMemo(() => {
    let headerHeight = FIXED_HORIZONTAL_HEDER_HEIGHT;
    if (isVerticalLayout) {
      headerHeight = FIXED_VERTICAL_HEADER_HEIGHT - 129;
    }

    return dimensions.height + headerHeight;
  }, [dimensions.height, isVerticalLayout]);

  const tabNames: string[] = Children.map(
    children,
    (child) =>
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      child.props.label,
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const ref = useRef<PagerView>(null);
  const renderTabBar = () => (
    <SegmentedControl
      style={{ height: 36, marginHorizontal: 16 }}
      values={tabNames}
      selectedIndex={selectedIndex}
      onChange={(index) => {
        ref.current?.setPage(index);
        setSelectedIndex(index);
        if (onTabChange) {
          onTabChange({
            index,
            tabName: tabNames[index],
          });
        }
        if (onIndexChange) {
          onIndexChange(index);
        }
      }}
    />
  );

  return (
    <NestedTabView
      {...props}
      style={{
        height,
      }}
    >
      {renderHeader?.()}
      {renderTabBar()}
      <Context.Provider value={tabNames[selectedIndex]}>
        <PagerView ref={ref} style={{ flex: 1 }}>
          {Children.map(children, (child, index) => (
            <View key={index} collapsable={false}>
              {child}
            </View>
          ))}
        </PagerView>
      </Context.Provider>
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
