import React, {
  CSSProperties,
  Children,
  ComponentProps,
  FC,
  ReactElement,
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Container as BaseContainer,
  MaterialTabBar,
} from 'react-native-collapsible-tab-view';
import { useDeepCompareMemo } from 'use-deep-compare';

import NativePagingView from '@onekeyhq/app/src/views/PagingView';

import FlatList from '../FlatList';
import { useIsVerticalLayout } from '../Provider/hooks';
import ScrollView from '../ScrollView';
import SectionList from '../SectionList';
import SegmentedControl from '../SegmentedControl';

export { MaterialTabBar };

type TabProps = {
  name: string;
  // eslint-disable-next-line react/no-unused-prop-types
  label?: string;
};

export function useTabProps(
  children: ReactElement<{ children: ReactNode } & TabProps>,
  tabType: FC<TabProps>,
) {
  const options = useMemo(() => {
    const tabOptions = new Map<string, { index: number } & TabProps>();

    if (children) {
      Children.forEach(children, (element, index) => {
        if (!element) return;
        if (element.type !== tabType)
          throw new Error(
            'Container children must be wrapped in a <Tabs.Tab ... /> component',
          );

        // eslint-disable-next-line @typescript-eslint/no-shadow
        const { name, children, ...options } = element.props;
        if (tabOptions.has(name))
          throw new Error(
            'Tab names must be unique, '.concat(name, ' already exists'),
          );
        tabOptions.set(name, {
          index,
          name,
          ...options,
        });
      });
    }

    return tabOptions;
  }, [children, tabType]);
  const optionEntries = Array.from(options.entries());
  const optionKeys = Array.from(options.keys());
  const memoizedOptions = useDeepCompareMemo(() => options, [optionEntries]);
  const memoizedTabNames = useDeepCompareMemo(() => optionKeys, [optionKeys]);
  return { options: memoizedOptions, names: memoizedTabNames };
}

const Context = createContext<string>('');

type ContainerProps = ComponentProps<typeof BaseContainer> & {
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
  initialTabName?: string;
};
const Container: FC<ContainerProps> = ({
  children,
  containerStyle,
  headerHeight,
  renderHeader,
  headerContainerStyle,
  onTabChange,
  onIndexChange,
  initialTabName,
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
      defaultIndex={selectedIndex}
      headerHeight={headerHeight}
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
