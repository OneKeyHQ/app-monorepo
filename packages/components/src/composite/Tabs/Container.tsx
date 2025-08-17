import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren, RefObject } from 'react';

import { debounce } from 'lodash';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
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
  containerWidth,
  ...props
}: PropsWithChildren<WindowScrollerChildProps> & {
  listContainerRef: RefObject<Element>;
  containerWidth: number | string | undefined;
}) {
  return (
    <TabsScrollContext.Provider value={props}>
      <XStack
        ref={listContainerRef as any}
        width={containerWidth || props.width}
        overflow="hidden"
        style={{ scrollSnapType: 'x' }}
      >
        {Children.map(children, (child, index) => {
          return (
            <div
              style={{
                width: '100%',
                flexShrink: 0,
                scrollSnapAlign: 'center',
              }}
              key={index}
            >
              {child}
            </div>
          );
        })}
      </XStack>
    </TabsScrollContext.Provider>
  );
}

const renderDefaultTabBar = (props: TabBarProps<string>) => {
  return <TabBar {...props} />;
};

interface IRefProps {
  ref: React.RefObject<{
    switchTab: (tabName: string) => void;
    switchTabWithIndex: (index: number) => void;
  }>;
}

export function Container({
  children,
  renderHeader,
  renderTabBar = renderDefaultTabBar,
  onIndexChange,
  onTabChange,
  width: containerWidth,
  ref: containerRef,
  initialTabName,
  ...props
}: PropsWithChildren<CollapsibleProps> & IRefProps) {
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
  const scrollTabElementDict = useMemo(() => {
    return tabNames.reduce((acc, name) => {
      acc[name] = {
        element: null,
        height: 0,
      };
      return acc;
    }, {} as { [key: string]: { element: HTMLElement | null; height: number } });
  }, [tabNames]);
  const scrollTabElementsRef = useRef<{
    [key: string]: {
      element: HTMLElement | null;
      height?: number;
    };
  }>(scrollTabElementDict);
  const contextValue = useMemo(
    () => ({ focusedTab, tabNames: sharedTabNames, scrollTabElementsRef }),
    [focusedTab, sharedTabNames],
  );
  const isEffectValid = useRef(true);
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
  const updateListContainerHeight = useCallback(
    (times = 0) => {
      if (times > 100) {
        return;
      }
      if (listContainerRef.current) {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
        const height =
          scrollTabElementsRef.current?.[focusedTab.value]?.element
            ?.clientHeight;

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
            const element =
              scrollTabElementsRef.current?.[focusedTab.value]?.element;
            if (element) {
              resizeObserverRef.current.observe(element);
            }
          }, 100);
        } else {
          console.error(
            `cannot update tab ${focusedTab.value} list container height: ${
              height || 0
            }`,
          );
          updateListContainerHeightTimerId.current = setTimeout(() => {
            updateListContainerHeight(times + 1);
          }, 250);
        }
      }
    },
    [focusedTab],
  );

  useLayoutEffect(() => {
    setScrollElement(ref.current);
    setTimeout(updateListContainerHeight, 250);
    return () => {
      isEffectValid.current = false;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (updateListContainerHeightTimerId.current) {
        clearTimeout(updateListContainerHeightTimerId.current);
      }
    };
  }, [updateListContainerHeight]);

  useLayoutEffect(() => {
    const callback = debounce(() => {
      if (listContainerRef.current) {
        const tabIndex = tabNames.findIndex(
          (name) => name === focusedTab.value,
        );
        listContainerRef.current.scrollTo({
          left: (scrollElement?.clientWidth || 0) * tabIndex,
          behavior: 'instant',
        });
        setTimeout(() => {
          updateListContainerHeight();
        });
      }
    }, 350);
    window.addEventListener('resize', callback);
    return () => {
      window.removeEventListener('resize', callback);
    };
  }, [focusedTab, scrollElement, tabNames, updateListContainerHeight]);

  useAnimatedReaction(
    () => focusedTab.value,
    (tabName, prevTabName) => {
      if (isEffectValid.current && prevTabName && tabName !== prevTabName) {
        isSwitchingTabRef.current = true;
        const index = tabNames.findIndex((name) => name === tabName);
        let scrollTop = scrollTopRef.current[tabName] || 0;
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
      }
    },
  );

  const onTabPress = useCallback(
    (tabName: string, emitEvents = true) => {
      if (!isEffectValid.current) {
        return;
      }
      const index = tabNames.findIndex((name) => name === tabName);
      const prevTabName = focusedTab.value;
      const prevIndex = tabNames.findIndex((name) => name === prevTabName);
      const onTabChangeData = {
        prevIndex,
        index,
        prevTabName,
        tabName,
      };
      if (emitEvents) {
        setTimeout(() => {
          onIndexChange?.(index);
          onTabChange?.(onTabChangeData);
        }, 100);
      }
      focusedTab.set(tabName);
    },
    [focusedTab, onIndexChange, onTabChange, tabNames],
  );

  useImperativeHandle(containerRef, () => ({
    switchTab: (tabName: string) => {
      onTabPress(tabName);
    },
    switchTabWithIndex: (index: number) => {
      onTabPress(tabNames[index]);
    },
  }));

  useEffect(() => {
    if (initialTabName) {
      setTimeout(() => {
        onTabPress(initialTabName, false);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              if (!isEffectValid.current || !width) {
                return null;
              }
              if (!isSwitchingTabRef.current) {
                scrollTopRef.current[focusedTab.value] =
                  scrollElement.scrollTop;
              }
              return (
                <>
                  <YStack
                    position="relative"
                    width={containerWidth ? undefined : width}
                    style={
                      containerWidth
                        ? {
                            width: containerWidth,
                          }
                        : undefined
                    }
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
                    containerWidth,
                  } as any)}
                  <ContainerChild
                    containerWidth={containerWidth}
                    height={height}
                    isScrolling={isScrolling}
                    scrollLeft={scrollLeft}
                    scrollTop={scrollTop}
                    width={scrollElement?.clientWidth || width || 0}
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
