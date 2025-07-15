import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ContextType, PropsWithChildren, RefObject } from 'react';

import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { WindowScroller } from 'react-virtualized';

import { XStack, YStack } from '../../primitives';

import { TabsContext, TabsScrollContext } from './context';
import { Header } from './Header';

import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';
import type { TabName } from 'react-native-collapsible-tab-view/lib/typescript/src/types';
import type { WindowScrollerChildProps } from 'react-virtualized';

export function ContainerChild({
  children,
  listContainerRef,
  ...props
}: PropsWithChildren<WindowScrollerChildProps> & {
  listContainerRef: RefObject<Element>;
}) {
  return (
    <TabsScrollContext.Provider value={props}>
      <XStack
        ref={listContainerRef as any}
        maxWidth={props.width}
        overflow="hidden"
      >
        <XStack w={props.width * 3}>
          {Children.map(children, (child, index) => {
            return (
              <div style={{ flex: 1 }} key={index}>
                {child}
              </div>
            );
          })}
        </XStack>
      </XStack>
    </TabsScrollContext.Provider>
  );
}

const renderDefaultHeader = (props: TabBarProps<string>) => {
  return <Header {...props} />;
};
export function Container({
  children,
  renderHeader,
  renderTabBar = renderDefaultHeader,
  ...props
}: PropsWithChildren<CollapsibleProps>) {
  // Get tab names from children props
  const scrollTopRef = useRef<{ [key: string]: number }>({});
  const tabNames = useMemo(() => {
    return Children.map(children, (child) => {
      if (
        isValidElement(child) &&
        'name' in (child.props as { name: string })
      ) {
        return (child.props as { name: string }).name;
      }
      return null;
    }).filter(Boolean);
  }, [children]);
  const sharedTabNames = useSharedValue<string[]>(tabNames);
  const focusedTab = useSharedValue<string>(tabNames[0] || '');
  const contextValue = useMemo(
    () => ({ focusedTab, tabNames: sharedTabNames }),
    [focusedTab, sharedTabNames],
  );
  const ref = useRef<Element>(null);
  const listContainerRef = useRef<Element>(null);

  const [scrollElement, setScrollElement] = useState<Element | null>(null);
  useLayoutEffect(() => {
    setScrollElement(ref.current);
  }, []);
  const onTabPress = useCallback(
    (tabName: string) => {
      // Header Height + tabBar height
      const headerHeight = 166;
      focusedTab.set(tabName);
      const scrollTop = scrollTopRef.current[tabName] || 0;
      console.log('scrollTop', scrollTop, tabName);
      const index = tabNames.findIndex((name) => name === tabName);
      document.startViewTransition(() => {
        const width = scrollElement?.clientWidth || 0;
        listContainerRef.current?.scrollTo({
          left: width * index,
          behavior: 'instant',
        });
        scrollElement?.scrollTo({
          top: scrollTop < headerHeight ? scrollTop : scrollTop + headerHeight,
          behavior: 'instant',
        });
      });
    },
    [focusedTab, scrollElement, tabNames],
  );
  return (
    <YStack
      flex={1}
      className="onekey-tabs-container"
      position="relative"
      style={{
        overflowY: 'scroll',
      }}
      ref={ref as React.RefObject<HTMLDivElement>}
    >
      {scrollElement ? (
        <TabsContext.Provider value={contextValue}>
          <WindowScroller scrollElement={scrollElement}>
            {({
              height,
              isScrolling,
              scrollLeft,
              scrollTop,
              width,
              onChildScroll,
              registerChild,
            }) => {
              console.log('scrollTop', focusedTab.value, scrollTop);
              scrollTopRef.current[focusedTab.value] = scrollTop;
              return (
                <>
                  {renderHeader?.({
                    indexDecimal: 0,
                    focusedTab,
                    tabNames,
                    index: 0,
                    containerRef: { current: null },
                    onTabPress,
                    tabProps: {},
                  })}
                  {renderTabBar?.({
                    indexDecimal: 0,
                    focusedTab,
                    tabNames,
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
                    listContainerRef={listContainerRef}
                  >
                    {children}
                  </ContainerChild>
                </>
              );
            }}
          </WindowScroller>
        </TabsContext.Provider>
      ) : null}
    </YStack>
  );
}
