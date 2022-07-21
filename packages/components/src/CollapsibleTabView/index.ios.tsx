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

import FlatList from '../FlatList';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import SegmentedControl from '../SegmentedControl';

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
}) => {
  const tabNames: string[] = Children.map(
    children,
    (child) =>
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      child.props.label,
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const ref = useRef<NativePagingView>(null);

  return (
    <NativePagingView
      ref={ref}
      style={{ flex: 1 }}
      defaultIndex={selectedIndex}
      headerHeight={headerHeight}
      // @ts-ignore
      renderHeader={renderHeader}
      renderTabBar={() => (
        <SegmentedControl
          style={{ width: 300, height: 36, paddingLeft: 16, paddingRight: 16 }}
          values={tabNames}
          selectedIndex={selectedIndex}
          onChange={(index) => {
            ref.current?.setPageIndex(index);
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
      )}
    >
      <Context.Provider value={tabNames[selectedIndex]}>
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
