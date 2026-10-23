import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { View } from 'react-native';
import { CollapsiblePagerView } from 'react-native-pager-view';

import { useTheme } from '@onekeyhq/components';
import type { IAppPagerProps } from '@onekeyhq/kit/src/components/AppPager';
import {
  AppPagerContext,
  AppPagerPageContext,
} from '@onekeyhq/kit/src/components/AppPager/context';
import type { IAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/types';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';

function TokenDetailsPage({
  page,
  isFocused,
  isMounted,
}: {
  page: IAppPagerPage;
  isFocused: boolean;
  isMounted: boolean;
}) {
  const context = useMemo(
    () => ({ key: page.key, name: page.name, isFocused }),
    [page.key, page.name, isFocused],
  );
  return (
    <View collapsable={false} style={{ flex: 1 }}>
      <AppPagerPageContext.Provider value={context}>
        {isMounted ? page.children : null}
      </AppPagerPageContext.Provider>
    </View>
  );
}

export function TokenDetailsPager({
  ref,
  pages,
  initialTabName,
  renderTabBar,
  onTabChange,
  onIndexChange,
  width,
}: IAppPagerProps & { width?: number }) {
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const [stickyHeight, setStickyHeight] = useState(48);
  const theme = useTheme();
  const isRouteFocused = useRouteIsFocused();
  const controller = useAppPagerController({
    pages,
    initialTabName,
    pagerRef,
    ref,
    onSelectionChange: onTabChange,
  });
  const {
    initialIndex,
    selectedIndex,
    focusedName,
    focusedTab,
    indexDecimal,
    jumpToTab,
  } = controller;
  const [visitedKeys, setVisitedKeys] = useState(
    () => new Set(pages[initialIndex] ? [pages[initialIndex].key] : []),
  );
  useEffect(() => {
    const liveKeys = new Set(pages.map((page) => page.key));
    const focusedKey = pages[selectedIndex]?.key;
    setVisitedKeys((current) => {
      const next = new Set([...current].filter((key) => liveKeys.has(key)));
      if (focusedKey) next.add(focusedKey);
      return next.size === current.size &&
        [...next].every((key) => current.has(key))
        ? current
        : next;
    });
  }, [pages, selectedIndex]);
  const scrollToTop = useCallback(() => {
    pagerRef.current?.scrollToPageTop({ animated: false });
  }, []);
  const context = useMemo(
    () => ({ focusedName, scrollToTop }),
    [focusedName, scrollToTop],
  );
  return (
    <AppPagerContext.Provider value={context}>
      <CollapsiblePagerView
        ref={pagerRef}
        style={{ flex: 1, width, backgroundColor: theme.bgApp.val }}
        initialPage={initialIndex}
        nestedScrollEnabled
        header={null}
        headerHeight={0}
        stickyHeaderHeight={stickyHeight}
        stickyHeader={
          <View
            onLayout={(event) => {
              const height = Math.ceil(event.nativeEvent.layout.height);
              setStickyHeight((current) =>
                current === height ? current : height,
              );
            }}
          >
            {renderTabBar?.({
              focusedTab,
              indexDecimal,
              tabNames: pages.map((page) => page.name),
              onTabPress: jumpToTab,
            })}
          </View>
        }
        pageRetentionDistance={pages.length}
        offscreenPageLimit={1}
        onPageScroll={({ nativeEvent }) => {
          indexDecimal.value = nativeEvent.position + nativeEvent.offset;
        }}
        onPageSelected={({ nativeEvent }) => {
          if (!pages[nativeEvent.position]) return;
          const selectedKey = pages[nativeEvent.position].key;
          setVisitedKeys((current) =>
            current.has(selectedKey)
              ? current
              : new Set([...current, selectedKey]),
          );
          onIndexChange?.(nativeEvent.position);
          controller.selectIndex(nativeEvent.position);
        }}
      >
        {pages.map((page, index) => (
          <TokenDetailsPage
            key={page.key}
            page={page}
            isFocused={isRouteFocused && index === selectedIndex}
            isMounted={visitedKeys.has(page.key) || index === selectedIndex}
          />
        ))}
      </CollapsiblePagerView>
    </AppPagerContext.Provider>
  );
}

export function TokenDetailsPaginationObserver(_props: {
  enabled: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  progressKey: string;
  onEndReached?: () => void | Promise<void>;
  onEndReachedThreshold?: number;
  padding: { top: number; bottom: number };
}) {
  return null;
}
