import {
  Children,
  ContextType,
  type PropsWithChildren,
  useCallback,
  useMemo,
} from 'react';

import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { WindowScroller } from 'react-virtualized';

import { XStack } from '../../primitives';

import { TabsContext, TabsScrollContext } from './context';

import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';
import type { TabName } from 'react-native-collapsible-tab-view/lib/typescript/src/types';
import type { WindowScrollerChildProps } from 'react-virtualized';

export function ContainerChild({
  children,
  ...props
}: PropsWithChildren<WindowScrollerChildProps>) {
  console.log('ContainerChild', props);
  return (
    <TabsScrollContext.Provider value={props}>
      <XStack w={props.width * 3 / 2}>
        {Children.map(children, (child, index) => {
          return (
            <div style={{ flex: 1 }} key={index}>
              {child}
            </div>
          );
        })}
      </XStack>
    </TabsScrollContext.Provider>
  );
}

const renderDefaultHeader = (props: TabBarProps<TabName>) => {
  return (
    <XStack>
      {['A', 'B', 'C'].map((tab) => (
        <XStack key={tab} onPress={() => props.onTabPress(tab)}>{tab}</XStack>
      ))}
    </XStack>
  );
};

export function Container({
  children,
  renderHeader,
  renderTabBar = renderDefaultHeader,
  ...props
}: PropsWithChildren<CollapsibleProps>) {
  const focusedTab = useSharedValue<string>('A');
  const contextValue = useMemo(() => ({ focusedTab }), [focusedTab]);

  const onTabPress = useCallback(
    (tabName: string) => {
      focusedTab.value = tabName;
      console.log('onTabPress', tabName);
    },
    [focusedTab],
  );
  return (
    <TabsContext.Provider value={contextValue}>
      <WindowScroller
        scrollElement={
          document.querySelector('[data-testid="HomePage"]') || undefined
        }
      >
        {({
          height,
          isScrolling,
          scrollLeft,
          scrollTop,
          width,
          onChildScroll,
          registerChild,
        }) => {
          console.log('WindowScroller', {
            height,
            isScrolling,
            scrollLeft,
            scrollTop,
            width,
          });
          return (
            <>
              {renderHeader?.({
                indexDecimal: 0,
                focusedTab: '',
                tabNames: [],
                index: 0,
                containerRef: { current: null },
                onTabPress,
                tabProps: {},
              })}
              {renderTabBar?.({
                indexDecimal: 0,
                focusedTab: '',
                tabNames: [],
                index: 0,
                onTabPress,
                containerRef: { current: null },
              })}
              <ContainerChild
                height={height}
                isScrolling={isScrolling}
                scrollLeft={scrollLeft}
                scrollTop={scrollTop}
                width={width}
                onChildScroll={onChildScroll}
                registerChild={registerChild}
              >
                {children}
              </ContainerChild>
            </>
          );
        }}
      </WindowScroller>
    </TabsContext.Provider>
  );
}
