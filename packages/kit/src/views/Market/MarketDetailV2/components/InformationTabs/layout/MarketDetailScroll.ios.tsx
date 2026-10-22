import { useCallback, useContext, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { FlatList } from 'react-native';
import { NativeScroller } from 'react-native-pager-view';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import { Tabs } from '@onekeyhq/components';
import {
  CollapsibleTabContext,
  CollapsibleTabNameContext,
} from '@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext';

import {
  MarketDetailNativeContext,
  MarketDetailNativePageContext,
} from './MarketDetailNativeContext';

import type {
  FlatListProps,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewProps,
} from 'react-native';

export function MarketDetailHeaderGesture({
  children,
}: {
  children: ReactNode;
}) {
  // The pager owns header gestures on native, including nested scroll views.
  return children;
}

function useNativeHeaderScroll() {
  const page = useContext(MarketDetailNativePageContext);
  const pager = useContext(MarketDetailNativeContext);
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (page?.isFocused && pager) {
        // Native smooth headers share the list's UIScrollView and content inset.
        const { contentOffset, contentInset } = event.nativeEvent;
        pager.headerOffset.value = Math.max(
          0,
          contentOffset.y + contentInset.top,
        );
      }
    },
    [page, pager],
  );
}

export function MarketDetailScrollView(
  props: Omit<ComponentProps<typeof NativeScroller>, 'ref'>,
) {
  const page = useContext(MarketDetailNativePageContext);
  const updateHeaderOffset = useNativeHeaderScroll();
  if (!page) {
    return <Tabs.ScrollView {...props} />;
  }
  return (
    <NativeScroller
      {...props}
      testID={props.testID ?? `market-detail-scroll-${page.key}`}
      pagerScrollKey={page.key}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      onScroll={(event) => {
        updateHeaderOffset(event);
        props.onScroll?.(event);
      }}
      style={[{ flex: 1 }, props.style]}
    />
  );
}

export function MarketDetailList<T>(props: FlatListProps<T>) {
  const page = useContext(MarketDetailNativePageContext);
  const updateHeaderOffset = useNativeHeaderScroll();
  const renderScrollComponent = useCallback(
    (scrollProps: ScrollViewProps) => (
      <NativeScroller
        {...scrollProps}
        pagerScrollKey={page?.key}
        // FlatList retains virtualization and owns its content/viewport events.
        onScroll={(event) => {
          updateHeaderOffset(event);
          if (page) page.scrollY.value = event.nativeEvent.contentOffset.y;
          scrollProps.onScroll?.(event);
        }}
      />
    ),
    [page, updateHeaderOffset],
  );
  if (!page) {
    return <Tabs.FlatList<T> {...props} />;
  }
  return (
    <FlatList<T>
      {...props}
      testID={props.testID ?? `market-detail-list-${page.key}`}
      style={[{ flex: 1 }, props.style]}
      renderScrollComponent={renderScrollComponent}
    />
  );
}

export function useMarketDetailFocusedTab() {
  const native = useContext(MarketDetailNativeContext);
  const legacy = useContext(CollapsibleTabContext);
  const [legacyName, setLegacyName] = useState(legacy?.focusedTab.value ?? '');
  useAnimatedReaction(
    () => legacy?.focusedTab.value,
    (name, previous) => {
      if (name !== undefined && name !== previous) {
        runOnJS(setLegacyName)(name);
      }
    },
    [legacy],
  );
  return native?.focusedName ?? legacyName;
}

export function useMarketDetailIsFocusedTab() {
  const page = useContext(MarketDetailNativePageContext);
  const focusedName = useMarketDetailFocusedTab();
  const legacyName = useContext(CollapsibleTabNameContext);
  return page?.isFocused ?? focusedName === legacyName;
}

export function useMarketDetailScrollY() {
  const page = useContext(MarketDetailNativePageContext);
  const legacy = useContext(CollapsibleTabContext);
  const fallback = useSharedValue(0);
  return page?.scrollY ?? legacy?.scrollYCurrent ?? fallback;
}
