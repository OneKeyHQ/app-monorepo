import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { CollapsiblePagerView } from 'react-native-pager-view';

import { useTheme } from '@onekeyhq/components';
import { BRAND_FONT_NATIVE_FAMILY } from '@onekeyhq/components/src/hocs/Provider/fonts/brandFont';
import type { IAppPagerProps } from '@onekeyhq/kit/src/components/AppPager';
import {
  AppPagerContext,
  AppPagerPageContext,
} from '@onekeyhq/kit/src/components/AppPager/context';
import type { IAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/types';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';

import type { LayoutChangeEvent } from 'react-native';

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

const TAB_BAR_HEIGHT = 44;
const STICKY_HEADER_HEIGHT = Math.ceil(
  TAB_BAR_HEIGHT + StyleSheet.hairlineWidth,
);

export function TokenDetailsPager({
  ref,
  pages,
  initialTabName,
  toolbar,
  onTabChange,
  onIndexChange,
  width,
}: IAppPagerProps & { width?: number; toolbar?: ReactNode }) {
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const theme = useTheme();
  const isRouteFocused = useRouteIsFocused();
  const controller = useAppPagerController({
    pages,
    initialTabName,
    pagerRef,
    ref,
    onSelectionChange: onTabChange,
  });
  const { initialIndex, selectedIndex, focusedName, indexDecimal } = controller;
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
  const handleToolbarLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
    setToolbarWidth((current) =>
      current === measuredWidth ? current : measuredWidth,
    );
  }, []);
  return (
    <AppPagerContext.Provider value={context}>
      <CollapsiblePagerView
        ref={pagerRef}
        style={{ flex: 1, width, backgroundColor: theme.bgApp.val }}
        initialPage={initialIndex}
        nestedScrollEnabled
        header={null}
        headerHeight={0}
        stickyHeaderHeight={STICKY_HEADER_HEIGHT}
        nativeTabBar={{
          items: pages.map((page) => ({
            key: page.key,
            title: page.name,
          })),
          style: {
            height: TAB_BAR_HEIGHT,
            contentPaddingHorizontal: 12,
            itemSpacing: 4,
            fontSize: 16,
            fontFamily: BRAND_FONT_NATIVE_FAMILY.medium,
            backgroundColor: theme.bgApp.val,
            activeTextColor: theme.text.val,
            inactiveTextColor: theme.textSubdued.val,
            indicatorColor: theme.text.val,
            indicatorHeight: 2,
            indicatorBottom: 0,
            trailingReservedWidth: toolbarWidth,
          },
        }}
        stickyHeader={
          <View
            pointerEvents="box-none"
            style={{
              flex: 1,
              borderBottomColor: theme.borderSubdued.val,
              borderBottomWidth: StyleSheet.hairlineWidth,
            }}
          >
            <View
              pointerEvents="box-none"
              onLayout={handleToolbarLayout}
              style={{
                position: 'absolute',
                end: 0,
                top: 0,
                height: TAB_BAR_HEIGHT,
                backgroundColor: theme.bgApp.val,
                justifyContent: 'center',
              }}
            >
              {toolbar}
            </View>
          </View>
        }
        pageRetentionDistance={pages.length}
        offscreenPageLimit={1}
        onNativeTabPress={({ nativeEvent }) => {
          const { position, key } = nativeEvent;
          if (!Number.isInteger(position) || pages[position]?.key !== key) {
            return;
          }
          setVisitedKeys((current) =>
            current.has(key) ? current : new Set([...current, key]),
          );
        }}
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
