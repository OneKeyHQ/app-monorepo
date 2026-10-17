import {
  Children,
  isValidElement,
  useCallback,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren, ReactNode, Ref } from 'react';

import { View } from 'react-native';
import { CollapsiblePagerView, NativeScroller } from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';

import type {
  ITabContainerProps,
  ITabContainerRef,
} from '@onekeyhq/components/src/composite/Tabs/Container';
import {
  TabsContext,
  TabsScrollContext,
} from '@onekeyhq/components/src/composite/Tabs/context';
import { TabNameContext } from '@onekeyhq/components/src/composite/Tabs/TabNameContext';

import type { TabBarProps } from 'react-native-collapsible-tab-view';
import type { NativeScrollerRef } from 'react-native-pager-view';

type IPage = { key: string; name: string; children: ReactNode };
type ITabsContext = React.ContextType<typeof TabsContext>;
type IWebCollapsiblePagerProps = PropsWithChildren<ITabContainerProps> & {
  ref?: Ref<ITabContainerRef>;
};

function scrollElement(node: unknown): HTMLElement | null {
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement
    ? node
    : null;
}

function useMeasuredElement() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback(
    (node: unknown) => setElement(scrollElement(node)),
    [],
  );
  useLayoutEffect(() => {
    if (!element) return undefined;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((previous) =>
        previous.width === rect.width && previous.height === rect.height
          ? previous
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref, size };
}

function WebPagerPage({
  page,
  active,
  context,
  resetGeneration,
  headerHeight,
  stickyHeight,
  renderSubHeader,
  onOwner,
  onScrollPosition,
  onUserInput,
}: {
  page: IPage;
  active: boolean;
  context: ITabsContext;
  resetGeneration: number;
  headerHeight: number;
  stickyHeight: number;
  renderSubHeader?: () => ReactNode;
  onOwner: (key: string, node: NativeScrollerRef | null) => void;
  onScrollPosition: (key: string, top: number) => void;
  onUserInput: (key: string) => void;
}) {
  const [owner, setOwner] = useState<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 0, scrollTop: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const registeredElementRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const activeRef = useRef(active);
  activeRef.current = active;
  const setScrollerRef = useCallback(
    (node: NativeScrollerRef | null) => {
      setOwner(scrollElement(node?.getScrollableNode()));
      onOwner(page.key, node);
    },
    [onOwner, page.key],
  );
  const measure = useCallback(() => {
    frameRef.current = undefined;
    if (!owner) return;
    const ownerRect = owner.getBoundingClientRect();
    const candidate = context.scrollTabElementsRef.current[page.name]?.element;
    const content = candidate?.isConnected ? candidate : null;
    if (registeredElementRef.current !== content) {
      if (registeredElementRef.current)
        observerRef.current?.unobserve(registeredElementRef.current);
      registeredElementRef.current = content;
      if (content) observerRef.current?.observe(content);
    }
    const contentRect = (
      content ?? owner.firstElementChild
    )?.getBoundingClientRect();
    const pinnedBottom =
      ownerRect.top +
      Math.max(0, headerHeight - owner.scrollTop) +
      stickyHeight;
    const visibleTop = Math.max(
      ownerRect.top,
      pinnedBottom,
      contentRect?.top ?? 0,
    );
    const next = {
      width: owner.clientWidth,
      height: Math.max(0, ownerRect.bottom - visibleTop),
      scrollTop: Math.max(0, pinnedBottom - (contentRect?.top ?? pinnedBottom)),
    };
    if (activeRef.current) context.scrollYCurrent.value = owner.scrollTop;
    setMetrics((previous) =>
      previous.width === next.width &&
      previous.height === next.height &&
      previous.scrollTop === next.scrollTop
        ? previous
        : next,
    );
  }, [
    owner,
    context.scrollTabElementsRef,
    context.scrollYCurrent,
    page.name,
    headerHeight,
    stickyHeight,
  ]);
  const requestRemeasure = useCallback(() => {
    if (frameRef.current === undefined)
      frameRef.current = requestAnimationFrame(measure);
  }, [measure]);
  const registerChild = useCallback(
    (node?: Element | null) => {
      const element = scrollElement(node);
      const previous = registeredElementRef.current;
      if (previous && previous !== element)
        observerRef.current?.unobserve(previous);
      registeredElementRef.current = element;
      if (element) {
        context.scrollTabElementsRef.current[page.name] = { element };
        observerRef.current?.observe(element);
      } else if (
        context.scrollTabElementsRef.current[page.name]?.element === previous
      ) {
        delete context.scrollTabElementsRef.current[page.name];
      }
      requestRemeasure();
    },
    [context.scrollTabElementsRef, page.name, requestRemeasure],
  );
  useLayoutEffect(
    () => () => {
      if (
        context.scrollTabElementsRef.current[page.name]?.element ===
        registeredElementRef.current
      )
        delete context.scrollTabElementsRef.current[page.name];
      registeredElementRef.current = null;
    },
    [context.scrollTabElementsRef, page.name],
  );
  useLayoutEffect(() => {
    if (!owner) return undefined;
    const observer = new ResizeObserver(requestRemeasure);
    observerRef.current = observer;
    observer.observe(owner);
    const content = context.scrollTabElementsRef.current[page.name]?.element;
    if (content) observer.observe(content);
    const hadOwnerClass = owner.classList.contains('onekey-tabs-container');
    owner.classList.add('onekey-tabs-container');
    const handleScroll = () => {
      onScrollPosition(page.key, owner.scrollTop);
      requestRemeasure();
    };
    const takeOver = () => onUserInput(page.key);
    const handleKey = (event: KeyboardEvent) => {
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'PageUp',
          'PageDown',
          'Home',
          'End',
          ' ',
        ].includes(event.key)
      )
        takeOver();
    };
    owner.addEventListener('scroll', handleScroll, { passive: true });
    owner.addEventListener('wheel', takeOver, { passive: true });
    owner.addEventListener('touchstart', takeOver, { passive: true });
    owner.addEventListener('pointerdown', takeOver);
    owner.addEventListener('keydown', handleKey);
    owner.addEventListener(
      'ok-collapsible-pager-insets-changed',
      requestRemeasure,
    );
    measure();
    return () => {
      observer.disconnect();
      observerRef.current = null;
      owner.removeEventListener('scroll', handleScroll);
      owner.removeEventListener('wheel', takeOver);
      owner.removeEventListener('touchstart', takeOver);
      owner.removeEventListener('pointerdown', takeOver);
      owner.removeEventListener('keydown', handleKey);
      if (!hadOwnerClass) owner.classList.remove('onekey-tabs-container');
      owner.removeEventListener(
        'ok-collapsible-pager-insets-changed',
        requestRemeasure,
      );
      if (frameRef.current !== undefined)
        cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    };
  }, [
    owner,
    measure,
    requestRemeasure,
    context.scrollTabElementsRef,
    page.name,
    page.key,
    onScrollPosition,
    onUserInput,
  ]);
  useLayoutEffect(requestRemeasure, [active, requestRemeasure]);
  const pageContext = useMemo(
    () => ({
      ...context,
      scrollElement: owner,
      requestRemeasure,
      width: metrics.width,
    }),
    [context, owner, requestRemeasure, metrics.width],
  );
  const scrollContext = useMemo(
    () => ({
      ...metrics,
      isScrolling: false,
      scrollLeft: 0,
      onChildScroll: () => {},
      registerChild,
      updateListContainerHeight: requestRemeasure,
    }),
    [metrics, registerChild, requestRemeasure],
  );
  return (
    <TabNameContext.Provider value={page.name}>
      <TabsContext.Provider value={pageContext}>
        <TabsScrollContext.Provider value={scrollContext}>
          <NativeScroller
            ref={setScrollerRef}
            pagerScrollKey={`${page.key}:${resetGeneration}`}
            style={{ flex: 1 }}
          >
            {active ? renderSubHeader?.() : null}
            {page.children}
          </NativeScroller>
        </TabsScrollContext.Provider>
      </TabsContext.Provider>
    </TabNameContext.Provider>
  );
}

/** Home and Market retain their business contexts while the SDK owns paging. */
export function WebCollapsiblePager({
  ref,
  children,
  renderHeader,
  renderTabBar,
  renderSubHeader,
  initialTabName,
  onTabChange,
  onIndexChange,
  disableScroll,
  isRouteFocused = true,
}: IWebCollapsiblePagerProps) {
  const inheritedContext = useContext(TabsContext);
  const pages = useMemo(
    () =>
      Children.toArray(children).flatMap((child, index) => {
        if (!isValidElement<{ name: string; children: ReactNode }>(child))
          return [];
        return [
          {
            key: String(child.key ?? index),
            name: child.props.name,
            children: child.props.children,
          },
        ];
      }),
    [children],
  );
  const initialIndex = Math.max(
    0,
    pages.findIndex((page) => page.name === initialTabName),
  );
  const [selectedKey, setSelectedKey] = useState(pages[initialIndex]?.key);
  const [resetGeneration, setResetGeneration] = useState(0);
  const selectedIndex = Math.max(
    0,
    pages.findIndex((page) => page.key === selectedKey),
  );
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const previousPageKeysRef = useRef(pages.map((page) => page.key));
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const ownersRef = useRef(
    new Map<
      string,
      { node: NativeScrollerRef; element: HTMLElement; lastTop: number }
    >(),
  );
  const routeOffsetRef = useRef<{ key: string; top: number } | null>(null);
  const routeFocusedRef = useRef(isRouteFocused);
  routeFocusedRef.current = isRouteFocused;
  const onOwner = useCallback((key: string, node: NativeScrollerRef | null) => {
    const element = scrollElement(node?.getScrollableNode());
    if (!node || !element) ownersRef.current.delete(key);
    else
      ownersRef.current.set(key, {
        node,
        element,
        lastTop: ownersRef.current.get(key)?.lastTop ?? 0,
      });
  }, []);
  const onScrollPosition = useCallback((key: string, top: number) => {
    const owner = ownersRef.current.get(key);
    if (owner && routeFocusedRef.current) owner.lastTop = top;
  }, []);
  const onUserInput = useCallback((key: string) => {
    if (routeOffsetRef.current?.key === key) routeOffsetRef.current = null;
  }, []);
  const restoreScrollPosition = useCallback(() => {
    const key = pagesRef.current[selectedIndexRef.current]?.key;
    const owner = key ? ownersRef.current.get(key) : undefined;
    if (!owner?.element.isConnected || owner.element.clientHeight === 0)
      return false;
    const saved = routeOffsetRef.current;
    if (!saved || saved.key !== key) return true;
    if (owner.element.scrollHeight - owner.element.clientHeight < saved.top)
      return false;
    owner.node.scrollTo({ y: saved.top, animated: false });
    owner.lastTop = saved.top;
    routeOffsetRef.current = null;
    return true;
  }, []);
  const scrollTabElementsRef = useRef<
    ITabsContext['scrollTabElementsRef']['current']
  >({});
  const focusedTab = useSharedValue(pages[initialIndex]?.name ?? '');
  const index = useSharedValue(initialIndex);
  const indexDecimal = useSharedValue(initialIndex);
  const sharedTabNames = useSharedValue(pages.map((page) => page.name));
  const scrollYCurrent = useSharedValue(0);
  const header = useMeasuredElement();
  const sticky = useMeasuredElement();
  const setIndex = useCallback((next: number) => {
    if (!pagesRef.current[next]) return;
    if (Math.abs(next - selectedIndexRef.current) > 1)
      pagerRef.current?.setPageWithoutAnimation(next);
    else pagerRef.current?.setPage(next);
  }, []);
  const jumpToTab = useCallback(
    (name: string) => {
      setIndex(pagesRef.current.findIndex((page) => page.name === name));
    },
    [setIndex],
  );
  const scrollToTop = useCallback(() => {
    routeOffsetRef.current = null;
    ownersRef.current.forEach((owner) => {
      owner.lastTop = 0;
    });
    setResetGeneration((value) => value + 1);
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      setIndex,
      jumpToTab,
      getCurrentIndex: () => selectedIndexRef.current,
      getFocusedTab: () =>
        pagesRef.current[selectedIndexRef.current]?.name ?? '',
      syncCurrentPage: () =>
        pagerRef.current?.setPageWithoutAnimation(selectedIndexRef.current),
      restoreScrollPosition,
    }),
    [jumpToTab, setIndex, restoreScrollPosition],
  );
  useLayoutEffect(() => {
    if (isRouteFocused) {
      restoreScrollPosition();
      return;
    }
    const key = pagesRef.current[selectedIndexRef.current]?.key;
    const owner = key ? ownersRef.current.get(key) : undefined;
    if (key && owner) routeOffsetRef.current = { key, top: owner.lastTop };
  }, [isRouteFocused, restoreScrollPosition]);
  useLayoutEffect(() => {
    const previousKeys = previousPageKeysRef.current;
    const keysChanged =
      previousKeys.length !== pages.length ||
      pages.some((page, pageIndex) => page.key !== previousKeys[pageIndex]);
    previousPageKeysRef.current = pages.map((page) => page.key);
    sharedTabNames.value = pages.map((page) => page.name);
    const selected = pages[selectedIndex];
    if (!selected) return;
    const removed = selected.key !== selectedKey;
    if (removed) setSelectedKey(selected.key);
    focusedTab.value = selected.name;
    index.value = selectedIndex;
    indexDecimal.value = selectedIndex;
    if (keysChanged) pagerRef.current?.setPageWithoutAnimation(selectedIndex);
    if (removed)
      onTabChange?.({
        prevIndex: selectedIndex,
        index: selectedIndex,
        prevTabName: '',
        tabName: selected.name,
      });
  }, [
    pages,
    selectedIndex,
    selectedKey,
    focusedTab,
    index,
    indexDecimal,
    sharedTabNames,
    onTabChange,
  ]);
  const context = useMemo(
    () => ({
      ...inheritedContext,
      focusedTab,
      tabNames: sharedTabNames,
      index,
      indexDecimal,
      scrollYCurrent,
      scrollTabElementsRef,
      scrollToTop,
      headerHeight: header.size.height,
      tabBarHeight: sticky.size.height,
    }),
    [
      inheritedContext,
      focusedTab,
      sharedTabNames,
      index,
      indexDecimal,
      scrollYCurrent,
      scrollToTop,
      header.size.height,
      sticky.size.height,
    ],
  );
  const tabBarProps = useMemo(
    () =>
      ({
        focusedTab,
        tabNames: pages.map((page) => page.name),
        onTabPress: jumpToTab,
      }) as unknown as TabBarProps<string>,
    [focusedTab, pages, jumpToTab],
  );
  return (
    <TabsContext.Provider value={context}>
      <CollapsiblePagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={initialIndex}
        scrollEnabled={!disableScroll}
        headerHeight={header.size.height}
        stickyHeaderHeight={sticky.size.height}
        pageRetentionDistance={pages.length}
        header={<View ref={header.ref}>{renderHeader?.()}</View>}
        stickyHeader={
          <View ref={sticky.ref}>{renderTabBar?.(tabBarProps)}</View>
        }
        onPageScroll={({ nativeEvent }) => {
          indexDecimal.value = nativeEvent.position + nativeEvent.offset;
        }}
        onPageSelected={({ nativeEvent }) => {
          const next = pages[nativeEvent.position];
          if (!next) return;
          const previous = selectedIndexRef.current;
          selectedIndexRef.current = nativeEvent.position;
          setSelectedKey(next.key);
          focusedTab.value = next.name;
          index.value = nativeEvent.position;
          onIndexChange?.(nativeEvent.position);
          onTabChange?.({
            prevIndex: previous,
            index: nativeEvent.position,
            prevTabName: pages[previous]?.name ?? '',
            tabName: next.name,
          });
        }}
      >
        {pages.map((page, pageIndex) => (
          <View key={page.key} style={{ flex: 1 }}>
            <WebPagerPage
              page={page}
              active={pageIndex === selectedIndex}
              context={context}
              resetGeneration={resetGeneration}
              headerHeight={header.size.height}
              stickyHeight={sticky.size.height}
              renderSubHeader={renderSubHeader}
              onOwner={onOwner}
              onScrollPosition={onScrollPosition}
              onUserInput={onUserInput}
            />
          </View>
        ))}
      </CollapsiblePagerView>
    </TabsContext.Provider>
  );
}
