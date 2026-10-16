import { useEffect, useMemo, useRef } from 'react';

import { Tabs, getTokenValue, useStyle } from '@onekeyhq/components';
import {
  useTabsContext,
  useTabsScrollContext,
} from '@onekeyhq/components/src/composite/Tabs/context';
import { useIsFocusedTab } from '@onekeyhq/components/src/composite/Tabs/hooks';
import { useTabNameContext } from '@onekeyhq/components/src/composite/Tabs/TabNameContext';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';

import { FrozenTopHistoryScrollObserver } from '../../pages/hooks/useFrozenTopHistoryData';

import { NativeHistoryList } from './NativeHistoryList';

import type { IHomeHistoryListViewProps } from './types';
import type { ViewStyle } from 'react-native';

const SharedHistoryList = withBrowserProvider(NativeHistoryList);

function WebHistoryPaginationObserver({
  enabled,
  onEndReached,
  onEndReachedThreshold,
  padding,
}: Pick<IHomeHistoryListViewProps, 'onEndReached' | 'onEndReachedThreshold'> & {
  enabled: boolean;
  padding: { top: number; bottom: number };
}) {
  const { scrollTop, height } = useTabsScrollContext();
  const { scrollTabElementsRef } = useTabsContext();
  const tabName = useTabNameContext();
  const isFocusedTab = useIsFocusedTab();
  const previousScrollTop = useRef(scrollTop);
  useEffect(() => {
    const changed = previousScrollTop.current !== scrollTop;
    previousScrollTop.current = scrollTop;
    if (!changed || !enabled || !isFocusedTab || !onEndReached) return;
    const content = scrollTabElementsRef.current?.[tabName]?.element;
    const scrollHeight =
      (content?.scrollHeight ?? 0) - padding.top - padding.bottom;
    if (scrollHeight <= 0) return;
    // Match the old virtual list's origin and total rows, excluding padding.
    const top = Math.max(0, scrollTop - padding.top);
    const threshold = (onEndReachedThreshold ?? 0.2) || 0.5;
    if ((top + height) / scrollHeight >= 1 - threshold) onEndReached();
  }, [
    scrollTop,
    height,
    enabled,
    isFocusedTab,
    onEndReached,
    onEndReachedThreshold,
    padding.top,
    padding.bottom,
    scrollTabElementsRef,
    tabName,
  ]);
  return null;
}

function spacing(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.startsWith('$')) {
      const resolved = Number(
        getTokenValue(value as Parameters<typeof getTokenValue>[0], 'space'),
      );
      if (Number.isFinite(resolved)) return resolved;
    }
  }
  return 0;
}

function WebHistoryList(props: IHomeHistoryListViewProps) {
  const { scrollElement } = useTabsContext();
  const isFocusedTab = useIsFocusedTab();
  const rawContentStyle =
    props.contentContainerStyle ||
    props.listViewStyleProps?.contentContainerStyle ||
    {};
  const rawSpacing = rawContentStyle as {
    marginTop?: unknown;
    mt?: unknown;
    paddingBottom?: unknown;
    pb?: unknown;
  };
  const contentStyle = useStyle(rawContentStyle, {
    resolveValues: 'value',
  }) as ViewStyle;
  const webContentPadding = useMemo(
    () => ({
      top: spacing(contentStyle.marginTop, rawSpacing.marginTop, rawSpacing.mt),
      bottom: spacing(
        contentStyle.paddingBottom,
        rawSpacing.paddingBottom,
        rawSpacing.pb,
      ),
    }),
    [
      contentStyle.marginTop,
      contentStyle.paddingBottom,
      rawSpacing.marginTop,
      rawSpacing.mt,
      rawSpacing.paddingBottom,
      rawSpacing.pb,
    ],
  );
  return (
    <>
      <WebHistoryPaginationObserver
        enabled={!!props.initialized && props.data.length > 0}
        onEndReached={props.onEndReached}
        onEndReachedThreshold={props.onEndReachedThreshold}
        padding={webContentPadding}
      />
      <FrozenTopHistoryScrollObserver
        enabled={props.frozenTopEnabled}
        onAwayFromTopChange={props.onAwayFromTopChange}
      />
      <Tabs.ScrollView>
        <SharedHistoryList
          {...props}
          webScrollHost={isFocusedTab ? (scrollElement ?? null) : null}
          webContentPadding={webContentPadding}
        />
      </Tabs.ScrollView>
    </>
  );
}

export function HomeHistoryListView(props: IHomeHistoryListViewProps) {
  if (!props.plainMode && props.observeFrozenTop) {
    return <WebHistoryList key={props.frozenTopIdentityKey} {...props} />;
  }
  const {
    frozenTopEnabled: _enabled,
    frozenTopIdentityKey: _identity,
    observeFrozenTop: _observe,
    onAwayFromTopChange: _onAway,
    ...listProps
  } = props;
  return <TxHistoryListView {...listProps} />;
}
