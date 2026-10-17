import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentProps, PropsWithChildren, ReactNode, Ref } from 'react';

import { View } from 'react-native';
import { CollapsiblePagerView, NativeScroller } from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';

import { YStack } from '@onekeyhq/components';
import {
  ScrollContentRegistrationContext,
  useScrollContentRegistration,
} from '@onekeyhq/components/src/composite/ScrollContentRegistration';
import type { IRegisterScrollContent } from '@onekeyhq/components/src/composite/ScrollContentRegistration';

import {
  WebPagerContext,
  WebPagerPageContext,
  useWebPagerPage,
} from './WebCollapsiblePagerContext';

import type {
  IWebCollapsiblePagerRef,
  IWebPagerPage,
  IWebPagerTabBarProps,
} from './WebCollapsiblePagerContext';
import type { NativeScrollerRef } from 'react-native-pager-view';

export type IWebCollapsiblePagerProps = {
  ref?: Ref<IWebCollapsiblePagerRef>;
  pages: readonly IWebPagerPage[];
  renderHeader?: () => ReactNode;
  renderTabBar?: (props: IWebPagerTabBarProps) => ReactNode;
  renderSubHeader?: () => ReactNode;
  initialTabName?: string;
  onTabChange?: (event: {
    prevIndex: number;
    index: number;
    prevTabName: string;
    tabName: string;
  }) => void;
  onIndexChange?: (index: number) => void;
  disableScroll?: boolean;
  isRouteFocused?: boolean;
};

export function WebPagerContent({
  children,
  style,
}: PropsWithChildren<{ style?: ComponentProps<typeof YStack>['style'] }>) {
  const { width, isFocused } = useWebPagerPage();
  const registerContent = useScrollContentRegistration();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const contentRef = useCallback(
    (node: unknown) => setElement(scrollElement(node)),
    [],
  );
  useEffect(() => {
    if (!isFocused || !element) return undefined;
    return registerContent?.(element);
  }, [element, isFocused, registerContent]);
  return (
    <YStack flex={1} style={style} ref={contentRef} width={width}>
      {children}
    </YStack>
  );
}

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
  resetGeneration,
  headerHeight,
  stickyHeight,
  renderSubHeader,
  onOwner,
  onScrollPosition,
  onUserInput,
  onGeometryChange,
}: {
  page: IWebPagerPage;
  active: boolean;
  resetGeneration: number;
  headerHeight: number;
  stickyHeight: number;
  renderSubHeader?: () => ReactNode;
  onOwner: (key: string, node: NativeScrollerRef | null) => void;
  onScrollPosition: (key: string, top: number) => void;
  onUserInput: (key: string) => void;
  onGeometryChange: (key: string) => void;
}) {
  const [owner, setOwner] = useState<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 0, scrollTop: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const registeredContentRef = useRef<{
    element: HTMLElement;
    height?: number;
  } | null>(null);
  const [registeredContent, setRegisteredContent] = useState<{
    element: HTMLElement;
    height?: number;
  } | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
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
    const candidate = registeredContentRef.current?.element;
    const content = candidate?.isConnected ? candidate : null;
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
    setMetrics((previous) =>
      previous.width === next.width &&
      previous.height === next.height &&
      previous.scrollTop === next.scrollTop
        ? previous
        : next,
    );
    onGeometryChange(page.key);
  }, [owner, headerHeight, stickyHeight, onGeometryChange, page.key]);
  const requestRemeasure = useCallback(() => {
    if (frameRef.current === undefined)
      frameRef.current = requestAnimationFrame(measure);
  }, [measure]);
  const registerContent = useCallback<IRegisterScrollContent>(
    (element, height) => {
      const previous = registeredContentRef.current;
      if (previous?.element !== element && previous)
        observerRef.current?.unobserve(previous.element);
      const entry = { element, height };
      registeredContentRef.current = entry;
      setRegisteredContent(entry);
      observerRef.current?.observe(element);
      requestRemeasure();
      return () => {
        if (registeredContentRef.current !== entry) return;
        observerRef.current?.unobserve(element);
        registeredContentRef.current = null;
        setRegisteredContent(null);
        requestRemeasure();
      };
    },
    [requestRemeasure],
  );
  useLayoutEffect(() => {
    if (!owner) return undefined;
    const observer = new ResizeObserver(requestRemeasure);
    observerRef.current = observer;
    observer.observe(owner);
    const content = registeredContentRef.current?.element;
    if (content) observer.observe(content);
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
    owner.addEventListener('ok-collapsible-pager-user-scroll', takeOver);
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
      owner.removeEventListener('ok-collapsible-pager-user-scroll', takeOver);
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
    page.key,
    onScrollPosition,
    onUserInput,
  ]);
  useLayoutEffect(requestRemeasure, [active, requestRemeasure]);
  const pageContext = useMemo(
    () => ({
      key: page.key,
      name: page.name,
      isFocused: active,
      owner,
      content: registeredContent?.element ?? null,
      contentHeight: registeredContent?.height,
      ...metrics,
    }),
    [page.key, page.name, active, owner, registeredContent, metrics],
  );
  return (
    <WebPagerPageContext.Provider value={pageContext}>
      <ScrollContentRegistrationContext.Provider value={registerContent}>
        <NativeScroller
          ref={setScrollerRef}
          pagerScrollKey={`${page.key}:${resetGeneration}`}
          style={{ flex: 1 }}
        >
          {active ? renderSubHeader?.() : null}
          {page.children}
        </NativeScroller>
      </ScrollContentRegistrationContext.Provider>
    </WebPagerPageContext.Provider>
  );
}

/** Home and Market retain their business contexts while the SDK owns paging. */
export function WebCollapsiblePager({
  ref,
  pages,
  renderHeader,
  renderTabBar,
  renderSubHeader,
  initialTabName,
  onTabChange,
  onIndexChange,
  disableScroll,
  isRouteFocused = true,
}: IWebCollapsiblePagerProps) {
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
  const measuredInsetsRef = useRef({ header: 0, sticky: 0 });
  const retryRestoreRef = useRef<(key: string) => void>(() => undefined);
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
    if (node && element) retryRestoreRef.current(key);
  }, []);
  const onScrollPosition = useCallback((key: string, top: number) => {
    const owner = ownersRef.current.get(key);
    if (owner && routeFocusedRef.current) owner.lastTop = top;
  }, []);
  const onUserInput = useCallback((key: string) => {
    if (routeOffsetRef.current?.key === key) routeOffsetRef.current = null;
  }, []);
  const restoreScrollPosition = useCallback(() => {
    if (!routeFocusedRef.current) return false;
    const key = pagesRef.current[selectedIndexRef.current]?.key;
    const owner = key ? ownersRef.current.get(key) : undefined;
    if (!owner?.element.isConnected || owner.element.clientHeight === 0)
      return false;
    const saved = routeOffsetRef.current;
    if (!saved || saved.key !== key) return true;
    const style = owner.element.style;
    const { header, sticky } = measuredInsetsRef.current;
    if (
      owner.element.getAttribute('data-collapsible-pager-active') !== 'true' ||
      style.getPropertyValue('--ok-collapsible-pager-header-inset').trim() !==
        `${Math.max(0, header)}px` ||
      style.getPropertyValue('--ok-collapsible-pager-sticky-inset').trim() !==
        `${Math.max(0, sticky)}px`
    )
      return false;
    if (owner.element.scrollHeight - owner.element.clientHeight < saved.top)
      return false;
    routeOffsetRef.current = null;
    owner.lastTop = saved.top;
    owner.node.scrollTo({ y: saved.top, animated: false });
    return true;
  }, []);
  const onGeometryChange = useCallback(
    (key: string) => {
      if (
        routeFocusedRef.current &&
        routeOffsetRef.current?.key === key &&
        pagesRef.current[selectedIndexRef.current]?.key === key
      )
        restoreScrollPosition();
    },
    [restoreScrollPosition],
  );
  retryRestoreRef.current = onGeometryChange;
  const focusedTab = useSharedValue(pages[initialIndex]?.name ?? '');
  const indexDecimal = useSharedValue(initialIndex);
  const header = useMeasuredElement();
  const sticky = useMeasuredElement();
  measuredInsetsRef.current = {
    header: header.size.height,
    sticky: sticky.size.height,
  };
  const setIndex = useCallback((next: number) => {
    if (!pagesRef.current[next]) return;
    if (next !== selectedIndexRef.current) routeOffsetRef.current = null;
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
    if (key && owner && routeOffsetRef.current?.key !== key)
      routeOffsetRef.current = { key, top: owner.lastTop };
  }, [isRouteFocused, restoreScrollPosition]);
  useLayoutEffect(() => {
    const previousKeys = previousPageKeysRef.current;
    const keysChanged =
      previousKeys.length !== pages.length ||
      pages.some((page, pageIndex) => page.key !== previousKeys[pageIndex]);
    previousPageKeysRef.current = pages.map((page) => page.key);
    const selected = pages[selectedIndex];
    if (
      routeOffsetRef.current &&
      (!pages.some((page) => page.key === routeOffsetRef.current?.key) ||
        routeOffsetRef.current.key !== selected?.key)
    )
      routeOffsetRef.current = null;
    if (!selected) return;
    const removed = selected.key !== selectedKey;
    if (removed) setSelectedKey(selected.key);
    focusedTab.value = selected.name;
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
    indexDecimal,
    onTabChange,
  ]);
  const context = useMemo(
    () => ({ focusedName: pages[selectedIndex]?.name ?? '', scrollToTop }),
    [pages, selectedIndex, scrollToTop],
  );
  const tabBarProps = useMemo<IWebPagerTabBarProps>(
    () => ({
      focusedTab,
      tabNames: pages.map((page) => page.name),
      onTabPress: jumpToTab,
    }),
    [focusedTab, pages, jumpToTab],
  );
  return (
    <WebPagerContext.Provider value={context}>
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
          if (next.key !== routeOffsetRef.current?.key)
            routeOffsetRef.current = null;
          const previous = selectedIndexRef.current;
          selectedIndexRef.current = nativeEvent.position;
          setSelectedKey(next.key);
          focusedTab.value = next.name;
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
              resetGeneration={resetGeneration}
              headerHeight={header.size.height}
              stickyHeight={sticky.size.height}
              renderSubHeader={renderSubHeader}
              onOwner={onOwner}
              onScrollPosition={onScrollPosition}
              onUserInput={onUserInput}
              onGeometryChange={onGeometryChange}
            />
          </View>
        ))}
      </CollapsiblePagerView>
    </WebPagerContext.Provider>
  );
}
