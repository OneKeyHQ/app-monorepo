import {
  Children,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren, RefObject } from 'react';

import { useSharedValue } from 'react-native-reanimated';
import { WindowScroller } from 'react-virtualized';

import { XStack, YStack } from '../../primitives';

import { TabsContext, TabsScrollContext } from './context';
import { TabBar } from './TabBar';
import { startViewTransition } from './utils';

import type { LayoutChangeEvent } from 'react-native';
import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';
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
        <XStack w={props.width * Children.count(children)}>
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

const renderDefaultTabBar = (props: TabBarProps<string>) => {
  return <TabBar {...props} />;
};
export function Container({
  children,
  renderHeader,
  renderTabBar = renderDefaultTabBar,
  onIndexChange,
  onTabChange,
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
  const scrollTabElementsRef = useRef<{
    [key: string]: {
      element: HTMLElement;
      height?: string;
    };
  }>({});
  const contextValue = useMemo(
    () => ({ focusedTab, tabNames: sharedTabNames, scrollTabElementsRef }),
    [focusedTab, sharedTabNames],
  );
  const ref = useRef<Element>(null);
  const listContainerRef = useRef<Element>(null);

  const stickyHeaderHeight = useRef(0);
  const handlerStickyHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    stickyHeaderHeight.current = event.nativeEvent.layout.height;
  }, []);

  const [scrollElement, setScrollElement] = useState<Element | null>(null);
  const isSwitchingTabRef = useRef(false);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const updateListContainerHeightTimerId = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const updateListContainerHeight = useCallback(() => {
    if (listContainerRef.current) {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      const height =
        scrollTabElementsRef.current?.[focusedTab.value]?.element.clientHeight;
      if (height) {
        (
          listContainerRef.current as HTMLElement
        ).style.maxHeight = `${height}px`;
        setTimeout(() => {
          resizeObserverRef.current = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry && entry.contentRect.height) {
              (
                listContainerRef.current as HTMLElement
              ).style.maxHeight = `${entry.contentRect.height}px`;
            }
          });
          resizeObserverRef.current.observe(
            scrollTabElementsRef.current?.[focusedTab.value]?.element,
          );
        }, 100);
      } else {
        updateListContainerHeightTimerId.current = setTimeout(
          updateListContainerHeight,
          250,
        );
      }
    }
  }, [focusedTab]);

  useLayoutEffect(() => {
    setScrollElement(ref.current);
    setTimeout(updateListContainerHeight, 250);
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (updateListContainerHeightTimerId.current) {
        clearTimeout(updateListContainerHeightTimerId.current);
      }
    };
  }, [updateListContainerHeight]);

  const onTabPress = useCallback(
    (tabName: string) => {
      isSwitchingTabRef.current = true;
      // Header Height + tabBar height
      let scrollTop = scrollTopRef.current[tabName] || 0;
      const index = tabNames.findIndex((name) => name === tabName);
      const prevTabName = focusedTab.value;
      const prevIndex = tabNames.findIndex((name) => name === prevTabName);
      const onTabChangeData = {
        prevIndex,
        index,
        prevTabName,
        tabName,
      };
      setTimeout(() => {
        onIndexChange?.(index);
        onTabChange?.(onTabChangeData);
      }, 100);
      focusedTab.set(tabName);
      startViewTransition(() => {
        updateListContainerHeight();
        const width = scrollElement?.clientWidth || 0;
        listContainerRef.current?.scrollTo({
          left: width * index,
          behavior: 'instant',
        });

        if (stickyHeaderHeight.current > 0) {
          if ((scrollElement?.scrollTop || 0) >= stickyHeaderHeight.current) {
            scrollTop = Math.max(scrollTop, stickyHeaderHeight.current);
            scrollElement?.scrollTo({
              top: scrollTop,
              behavior: 'instant',
            });
          }
        }
        isSwitchingTabRef.current = false;
      });
    },
    [
      focusedTab,
      onIndexChange,
      onTabChange,
      scrollElement,
      tabNames,
      updateListContainerHeight,
    ],
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
        <TabsContext.Provider value={contextValue as any}>
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
              if (!isSwitchingTabRef.current) {
                scrollTopRef.current[focusedTab.value] =
                  scrollElement.scrollTop;
              }
              return (
                <>
                  <YStack
                    position="relative"
                    onLayout={handlerStickyHeaderLayout}
                  >
                    {renderHeader?.({
                      focusedTab,
                      tabNames,
                      onTabPress,
                    } as any)}
                  </YStack>
                  {renderTabBar?.({
                    focusedTab,
                    tabNames,
                    onTabPress,
                  } as any)}
                  <ContainerChild
                    height={height}
                    isScrolling={isScrolling}
                    scrollLeft={scrollLeft}
                    scrollTop={scrollTop}
                    width={width}
                    onChildScroll={onChildScroll}
                    registerChild={registerChild}
                    listContainerRef={listContainerRef as any}
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
