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
import { useConvertAnimatedToValue } from './useFocusedTab';
import { parseCssSize } from './utils';

import type { LayoutChangeEvent } from 'react-native';
import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';
import type { SharedValue } from 'react-native-reanimated';
import type { WindowScrollerChildProps } from 'react-virtualized';

const overflowYScrollStyle = { overflowY: 'scroll' } as const;
const scrollSnapStyle = { scrollSnapType: 'x' } as const;
const childDivStyle = {
  width: '100%',
  flexShrink: 0,
  scrollSnapAlign: 'center',
} as const;

export function ContainerChild({
  children,
  listContainerRef,
  containerWidth,
  focusedTab,
  tabNames,
  ...props
}: PropsWithChildren<WindowScrollerChildProps> & {
  listContainerRef: RefObject<Element>;
  containerWidth: number | string | undefined;
  focusedTab: SharedValue<string>;
  tabNames: (string | null)[];
}) {
  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  const syncFocusedTabVisibility = useCallback(
    (tabName: string) => {
      const focusedIndex = tabNames.findIndex((name) => name === tabName);
      if (focusedIndex < 0 || !listContainerRef.current) return;
      listContainerRef.current.childNodes.forEach((element, index) => {
        if (!element) return;
        const style = (element as HTMLElement).style;
        const next = focusedIndex === index ? 'visible' : 'hidden';
        // Avoid redundant style writes during rapid focus changes.
        if (style.getPropertyValue('content-visibility') !== next) {
          style.setProperty('content-visibility', next);
        }
      });
    },
    [listContainerRef, tabNames],
  );

  useAnimatedReaction(
    () => focusedTab.value,
    (tabName) => {
      syncFocusedTabVisibility(tabName);
    },
    [tabNames, focusedTab, listContainerRef, syncFocusedTabVisibility],
  );

  useEffect(
    () => syncFocusedTabVisibility(focusedTabValue ?? ''),
    [focusedTabValue, syncFocusedTabVisibility],
  );
  return (
    <TabsScrollContext.Provider value={props}>
      <XStack
        ref={listContainerRef as any}
        width={containerWidth || props.width}
        overflow="hidden"
        style={scrollSnapStyle}
      >
        {Children.map(children, (child, index) => {
          const key =
            isValidElement(child) &&
            child.props !== null &&
            typeof child.props === 'object' &&
            'name' in child.props
              ? (child.props as { name: string }).name
              : index;
          return (
            <div style={childDivStyle} key={key}>
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

export interface ITabContainerRef {
  jumpToTab: (tabName: string) => void;
  setIndex: (index: number) => void;
  getFocusedTab: () => string;
  getCurrentIndex: () => number;
  syncCurrentPage: () => void;
}

export interface ITabContainerProps {
  renderHeader?: () => React.ReactNode;
  renderTabBar?: (props: TabBarProps<string>) => React.ReactNode;
  /**
   * Slot rendered below the sticky TabBar and above the virtualized tab
   * content. Scrolls with the page flow (non-sticky) and slides behind the
   * TabBar when the user scrolls down. Use this for per-tab banners that must
   * not live inside the virtualized list's CellMeasurer cache.
   */
  renderSubHeader?: () => React.ReactNode;
  onIndexChange?: (index: number) => void;
  onTabChange?: (data: {
    prevIndex: number;
    index: number;
    prevTabName: string;
    tabName: string;
  }) => void;
  width?: number | string;
  initialTabName?: string;
  allowHeaderOverscroll?: boolean;
  disableScroll?: boolean;
  /** Only used on native Android, ignored on web */
  useNativeHeaderAnimation?: boolean;
}

interface ITabContainerRefProps {
  ref?: React.RefObject<ITabContainerRef>;
}

export function Container({
  children,
  renderHeader,
  renderTabBar = renderDefaultTabBar,
  renderSubHeader,
  onIndexChange,
  onTabChange,
  width: containerWidth,
  ref: containerRef,
  initialTabName,
  disableScroll,
}: PropsWithChildren<CollapsibleProps> &
  ITabContainerRefProps &
  Pick<
    ITabContainerProps,
    'disableScroll' | 'useNativeHeaderAnimation' | 'renderSubHeader'
  >) {
  const getTabContentHeight = useCallback((element: Element | null) => {
    const htmlElement = element as HTMLElement | null;
    if (!htmlElement) {
      return 0;
    }

    const style = globalThis.getComputedStyle(htmlElement);
    const verticalSpacing =
      parseCssSize(style.marginTop) +
      parseCssSize(style.marginBottom) +
      parseCssSize(style.paddingTop) +
      parseCssSize(style.paddingBottom);
    const virtualizedInnerElement = htmlElement.querySelector<HTMLElement>(
      [
        '.ReactVirtualized__Grid__innerScrollContainer',
        '.ReactVirtualized__Collection__innerScrollContainer',
      ].join(','),
    );
    // Cheap path first: only force a synchronous layout via
    // getBoundingClientRect when scrollHeight/clientHeight both come back 0.
    const virtualizedCheap = virtualizedInnerElement
      ? Math.max(
          virtualizedInnerElement.scrollHeight || 0,
          virtualizedInnerElement.clientHeight || 0,
        ) + verticalSpacing
      : 0;
    const cheap = Math.max(
      htmlElement.scrollHeight || 0,
      htmlElement.clientHeight || 0,
      virtualizedCheap,
    );
    if (cheap) return cheap;
    const virtualizedFallback = virtualizedInnerElement
      ? virtualizedInnerElement.getBoundingClientRect().height + verticalSpacing
      : 0;
    return Math.max(
      htmlElement.getBoundingClientRect().height || 0,
      virtualizedFallback,
    );
  }, []);

  // Get tab names from children props
  const scrollTopRef = useRef<{ [key: string]: number }>({});
  const tabNames = useMemo(() => {
    return Children.map(children, (child) => {
      if (
        isValidElement(child) &&
        child.props !== null &&
        typeof child.props === 'object' &&
        'name' in child.props
      ) {
        return (child.props as { name: string }).name;
      }
      return null;
    }).filter(Boolean);
  }, [children]);
  // Keep current tabNames reachable from stable callbacks (onTabPress)
  // without invalidating their identity on every parent re-render.
  const tabNamesRef = useRef(tabNames);
  tabNamesRef.current = tabNames;
  const sharedTabNames = useSharedValue<string[]>(tabNames);
  const focusedTab = useSharedValue<string>(
    initialTabName || tabNames[0] || '',
  );
  // `tabNames` is recreated every render via `Children.map`, so depending on
  // the array reference would re-fire the effect on every parent render even
  // when the tab list hasn't actually changed. Key off a stable signature
  // instead so we only write to the shared value when the names truly differ.
  const tabNamesKey = useMemo(() => tabNames.join('\u0000'), [tabNames]);
  useEffect(() => {
    sharedTabNames.value = tabNames;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedTabNames, tabNamesKey]);
  // Lazy: List.tsx fills missing entries itself. Avoid recomputing a fresh
  // dict on every tabNames change (the result was never written into the ref
  // after the initial render anyway).
  const scrollTabElementsRef = useRef<{
    [key: string]: {
      element: HTMLElement | null;
      height?: number;
    };
  }>({});
  // requestRemeasure lets List.tsx / ScrollView.tsx signal "I just wrote a
  // new element into scrollTabElementsRef" so Container can attach its
  // ResizeObserver immediately, without polling.
  const requestRemeasureRef = useRef<() => void>(() => {});
  const contextValue = useMemo(
    () => ({
      focusedTab,
      tabNames: sharedTabNames,
      scrollTabElementsRef,
      requestRemeasure: () => requestRemeasureRef.current(),
    }),
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
  const observedElementRef = useRef<HTMLElement | null>(null);
  // Last height written to listContainerRef. Because listContainerRef is the
  // single shared scroll content whose height always tracks the focused tab,
  // this is "the previous tab's height" — comparing the next tab against it
  // tells us whether we just switched to a TALLER tab.
  const lastListContainerHeightRef = useRef(0);
  // Armed during a settle window after each tab switch (see the reaction
  // below). While armed, any growth of the focused tab's content (re)arms a
  // debounced refresh; the window auto-expires so post-settle load-more
  // growth never toggles display mid-scroll.
  const extentRefreshArmedRef = useRef(false);
  // Hard cap that disarms the settle window.
  const extentRefreshWindowTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  // Debounce so progressive restoration and any row-measure jitter collapse
  // into a single refresh at the final settled height — no magnitude
  // threshold and no per-grow toggling needed.
  const extentRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // A scroll container whose content first shrinks (the previously-focused
  // taller tab is hidden by react-freeze, so listContainerRef height drops to
  // the shorter tab) and then grows back (switching to the taller tab again)
  // can keep a STALE, too-small scroll extent: scrollHeight and programmatic
  // `scrollTop = n` are correct, but compositor/async-driven wheel scrolling
  // clamps to the previous, shorter tab's extent — so the user cannot scroll
  // to the bottom. We reproduced this on Chromium (the Electron desktop
  // surface), whose threaded scrolling makes it easy to hit; this is NOT
  // assumed to be Chromium-only — engines with async scrolling (WebKit/Gecko)
  // can behave the same, so the refresh is intentionally not gated by browser.
  // Neither a reflow, an overflow toggle, a content-height change, nor a
  // window resize refreshes the cached extent; only tearing down and
  // rebuilding the list container's layout box does. The rebuild reads the
  // CURRENT layout, so it is correct regardless of which tab we came from, and
  // is a cheap no-op where the extent was already correct. Toggle display
  // synchronously so no frame is painted in between (no visible flash), and
  // restore scrollTop because display:none collapses it to 0.
  const refreshScrollExtent = useCallback(() => {
    const lc = listContainerRef.current as HTMLElement | null;
    const scroller = scrollElement as HTMLElement | null;
    if (!lc) return;
    const prevScrollTop = scroller?.scrollTop ?? 0;
    const prevDisplay = lc.style.display;
    // Collapsing the list box momentarily clamps the scroller to 0, which the
    // WindowScroller scroll handler would persist into scrollTopRef. Borrow
    // the same flag tab-switch uses to suppress that bookkeeping while we tear
    // the box down and restore it.
    const prevSwitching = isSwitchingTabRef.current;
    isSwitchingTabRef.current = true;
    lc.style.display = 'none';
    // Force a synchronous reflow so the box is actually torn down before it is
    // restored on the next line.
    void lc.offsetHeight;
    lc.style.display = prevDisplay;
    // Restoring scrollTop reads layout, which flushes the rebuilt box, so the
    // assignment clamps against the fresh (full) extent rather than 0.
    if (scroller && scroller.scrollTop !== prevScrollTop) {
      scroller.scrollTop = prevScrollTop;
    }
    isSwitchingTabRef.current = prevSwitching;
  }, [scrollElement]);
  // Attach (or re-attach) a ResizeObserver to the focused tab's scroll
  // element so listContainerRef height follows it. Replaces the previous
  // 250ms-polling retry loop entirely:
  //  - if the inner Tabs.List hasn't registered yet, fall back to the
  //    indexed container child; requestRemeasure will re-attach once
  //    List.tsx / ScrollView.tsx writes the element ref.
  //  - if the element is registered but currently 0-height, the observer
  //    sits idle until content lands, then fires once and the height is
  //    written. No console spam, no forced layout flushes, no retries.
  const attachObserverForFocusedTab = useCallback(() => {
    if (!isEffectValid.current) return;
    if (!listContainerRef.current) return;
    const tabIndex = tabNames.findIndex((name) => name === focusedTab.value);
    const registeredElement =
      scrollTabElementsRef.current?.[focusedTab.value]?.element;
    const fallbackElement =
      tabIndex >= 0 ? listContainerRef.current.children.item(tabIndex) : null;
    const element = (registeredElement ??
      fallbackElement) as HTMLElement | null;
    const apply = (targetElement: HTMLElement) => {
      const containerElement = listContainerRef.current as HTMLElement | null;
      if (!containerElement) return;
      const currentRegisteredElement =
        scrollTabElementsRef.current?.[focusedTab.value]?.element;
      const registeredHeight =
        scrollTabElementsRef.current?.[focusedTab.value]?.height;
      const shouldMeasureFallbackNaturalHeight =
        !currentRegisteredElement && targetElement === fallbackElement;
      if (shouldMeasureFallbackNaturalHeight) {
        containerElement.style.height = '';
      }
      const h =
        typeof registeredHeight === 'number' &&
        Number.isFinite(registeredHeight)
          ? registeredHeight
          : getTabContentHeight(targetElement);
      if (h > 0) {
        const grew = h > lastListContainerHeightRef.current;
        containerElement.style.height = `${h}px`;
        lastListContainerHeightRef.current = h;
        // Any growth that follows a tab switch can strand the stale compositor
        // extent (arriving at a tab taller than the one just left — for any
        // pair, not only the tallest tab). Debounce so progressive react-freeze
        // / content-visibility restoration and row-measure jitter collapse into
        // a single refresh once the height stops changing, at the final height.
        // The window auto-expires (see the tab-switch reaction) so later
        // load-more growth on the settled tab never toggles display mid-scroll.
        if (grew && extentRefreshArmedRef.current) {
          if (extentRefreshDebounceRef.current) {
            clearTimeout(extentRefreshDebounceRef.current);
          }
          extentRefreshDebounceRef.current = setTimeout(() => {
            extentRefreshDebounceRef.current = null;
            refreshScrollExtent();
          }, 150);
        }
      } else {
        containerElement.style.height = '';
      }
    };
    // Same element + already observing -> nothing to do.
    if (element && observedElementRef.current === element) {
      apply(element);
      return;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    observedElementRef.current = element;
    if (!element) {
      return;
    }
    // Synchronous initial measurement so the container doesn't flicker
    // between 0-height and the first observer callback.
    apply(element);
    const ro = new ResizeObserver(() => apply(element));
    ro.observe(element);
    resizeObserverRef.current = ro;
  }, [focusedTab, getTabContentHeight, tabNames, refreshScrollExtent]);

  // Keep the requestRemeasure context callback pointing at the latest
  // attach function. We use an indirection ref so contextValue identity
  // stays stable across re-renders.
  requestRemeasureRef.current = attachObserverForFocusedTab;

  useLayoutEffect(() => {
    isEffectValid.current = true;
    setScrollElement(ref.current);
    // First attach attempt. If the focused tab's inner element isn't
    // registered yet, List.tsx/ScrollView.tsx will call requestRemeasure
    // once it is.
    attachObserverForFocusedTab();
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      observedElementRef.current = null;
    };
  }, [attachObserverForFocusedTab]);

  // isEffectValid lives independently of the ResizeObserver lifecycle so
  // that re-runs of the attach effect (deps change) don't permanently
  // disable the component via the cleanup path.
  useEffect(
    () => () => {
      isEffectValid.current = false;
      if (extentRefreshWindowTimerRef.current) {
        clearTimeout(extentRefreshWindowTimerRef.current);
        extentRefreshWindowTimerRef.current = null;
      }
      if (extentRefreshDebounceRef.current) {
        clearTimeout(extentRefreshDebounceRef.current);
        extentRefreshDebounceRef.current = null;
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const index = tabNames.findIndex((name) => name === focusedTab.value);
    if (index < 0) {
      const firstTabName = tabNames[0];
      if (firstTabName) {
        focusedTab.set(firstTabName);
      }
      return;
    }

    attachObserverForFocusedTab();
    const width = scrollElement?.clientWidth || 0;
    if (width) {
      listContainerRef.current?.scrollTo({
        left: width * index,
        behavior: 'instant',
      });
    }
  }, [focusedTab, scrollElement, tabNames, attachObserverForFocusedTab]);

  useLayoutEffect(() => {
    const callback = debounce(() => {
      if (listContainerRef.current) {
        const tabIndex = tabNamesRef.current.findIndex(
          (name) => name === focusedTab.value,
        );
        listContainerRef.current.scrollTo({
          left: (scrollElement?.clientWidth || 0) * tabIndex,
          behavior: 'instant',
        });
        // ResizeObserver will fire on its own if the viewport change
        // altered the observed element's size, but force a re-attach
        // here in case the focused element changed identity due to a
        // remount during the resize.
        attachObserverForFocusedTab();
      }
    }, 350);
    window.addEventListener('resize', callback);
    return () => {
      window.removeEventListener('resize', callback);
    };
  }, [focusedTab, scrollElement, attachObserverForFocusedTab]);

  useAnimatedReaction(
    () => focusedTab.value,
    (tabName, prevTabName) => {
      if (isEffectValid.current && prevTabName && tabName !== prevTabName) {
        isSwitchingTabRef.current = true;
        // Arm the stale-scroll-extent refresh for a settle window: while armed,
        // `apply` debounces a refresh as the newly-focused tab's content grows
        // back to its full height. A fresh switch drops any debounce queued for
        // the previous tab. The window auto-expires so later (load-more) growth
        // on the settled tab does not toggle display mid-scroll.
        extentRefreshArmedRef.current = true;
        if (extentRefreshDebounceRef.current) {
          clearTimeout(extentRefreshDebounceRef.current);
          extentRefreshDebounceRef.current = null;
        }
        if (extentRefreshWindowTimerRef.current) {
          clearTimeout(extentRefreshWindowTimerRef.current);
        }
        extentRefreshWindowTimerRef.current = setTimeout(() => {
          extentRefreshArmedRef.current = false;
          extentRefreshWindowTimerRef.current = null;
        }, 1000);
        const index = tabNamesRef.current.findIndex((name) => name === tabName);
        let scrollTop = scrollTopRef.current[tabName] || 0;

        // Execute DOM updates synchronously instead of inside startViewTransition.
        // startViewTransition's callback runs asynchronously and gets aborted when
        // a new transition starts during rapid switching, which causes scrollTo
        // to never execute and the tab switch to visually fail.
        attachObserverForFocusedTab();
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
      }
    },
    // Explicit deps prevent the reaction from rebuilding on every render
    // (auto-detect kept rebuilding because the worklet closed over JS state)
    // and ensure scrollElement / attachObserverForFocusedTab aren't stale.
    [focusedTab, scrollElement, attachObserverForFocusedTab],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (initialTabName) {
        const index = tabNamesRef.current.findIndex(
          (name) => name === initialTabName,
        );
        if (index !== -1) {
          const width = ref.current?.clientWidth || 0;
          listContainerRef.current?.scrollTo({
            left: width * index,
            behavior: 'instant',
          });
        }
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTabPress = useCallback(
    (tabName: string, emitEvents = true) => {
      if (!isEffectValid.current) {
        return;
      }
      const names = tabNamesRef.current;
      const index = names.findIndex((name) => name === tabName);
      const prevTabName = focusedTab.value;
      const prevIndex = names.findIndex((name) => name === prevTabName);
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
    // Read tabNames via ref so onTabPress identity stays stable across
    // parent renders that would otherwise produce structurally-equal but
    // new-identity tabNames arrays.
    [focusedTab, onIndexChange, onTabChange],
  );

  useImperativeHandle(
    containerRef,
    () => ({
      jumpToTab: (tabName: string) => {
        onTabPress(tabName);
      },
      setIndex: (index: number) => {
        onTabPress(tabNamesRef.current[index]);
      },
      getFocusedTab: () => {
        return focusedTab.value;
      },
      getCurrentIndex: () => {
        return tabNamesRef.current.findIndex(
          (name) => name === focusedTab.value,
        );
      },
      syncCurrentPage: () => {
        // no-op on web, only needed for native PagerView
      },
    }),
    [focusedTab, onTabPress],
  );

  // Memoised args for renderHeader/renderTabBar. tabNames identity may
  // legitimately change when children change; that's the only time these
  // need to be rebuilt (focusedTab and onTabPress are stable refs).
  const headerArgs = useMemo(
    () =>
      ({ focusedTab, tabNames, onTabPress }) as unknown as TabBarProps<string>,
    [focusedTab, tabNames, onTabPress],
  );
  const tabBarArgs = useMemo(
    () =>
      ({
        focusedTab,
        tabNames,
        onTabPress,
        containerWidth,
      }) as unknown as TabBarProps<string>,
    [focusedTab, tabNames, onTabPress, containerWidth],
  );

  return (
    <YStack
      flex={1}
      className="onekey-tabs-container"
      position="relative"
      style={disableScroll ? undefined : overflowYScrollStyle}
      ref={ref as React.RefObject<HTMLDivElement>}
    >
      {scrollElement ? (
        <TabsContext.Provider value={contextValue as any}>
          {/* renderHeader / renderTabBar / renderSubHeader live OUTSIDE the
              WindowScroller children fn so they are not re-invoked on every
              scroll event. Only ContainerChild needs scroll-derived props. */}
          <YStack
            position="relative"
            width={containerWidth || '100%'}
            onLayout={handlerStickyHeaderLayout}
          >
            {renderHeader?.(headerArgs)}
          </YStack>
          {renderTabBar?.(tabBarArgs)}
          {renderSubHeader?.()}
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
                  focusedTab={focusedTab}
                  tabNames={tabNames}
                >
                  {children}
                </ContainerChild>
              );
            }}
          </WindowScroller>
        </TabsContext.Provider>
      ) : null}
    </YStack>
  );
}
