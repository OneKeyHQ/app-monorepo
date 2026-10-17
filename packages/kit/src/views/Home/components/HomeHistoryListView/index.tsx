import { useEffect, useMemo, useRef } from 'react';

import { getTokenValue, useStyle } from '@onekeyhq/components';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { WebPagerContent } from '@onekeyhq/kit/src/components/WebCollapsiblePager';
import { useWebPagerPage } from '@onekeyhq/kit/src/components/WebCollapsiblePagerContext';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';

import { FrozenTopHistoryScrollObserver } from '../../pages/hooks/useFrozenTopHistoryData';

import { NativeHistoryList } from './NativeHistoryList';

import type { IHomeHistoryListViewProps } from './types';
import type { ViewStyle } from 'react-native';

const SharedHistoryList = withBrowserProvider(NativeHistoryList);

function WebHistoryPaginationObserver({
  enabled,
  hasMore,
  isLoadingMore,
  progressKey,
  onEndReached,
  onEndReachedThreshold,
  padding,
}: Pick<IHomeHistoryListViewProps, 'onEndReached' | 'onEndReachedThreshold'> & {
  enabled: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  progressKey: string;
  padding: { top: number; bottom: number };
}) {
  const {
    scrollTop,
    height,
    content,
    isFocused: isFocusedTab,
  } = useWebPagerPage();
  const previousScrollTop = useRef(scrollTop);
  const attemptedShortPage = useRef<string | undefined>(undefined);
  useEffect(() => {
    const changed = previousScrollTop.current !== scrollTop;
    previousScrollTop.current = scrollTop;
    if (!enabled || !isFocusedTab || !onEndReached || !hasMore || isLoadingMore)
      return;
    const scrollHeight =
      (content?.scrollHeight ?? 0) - padding.top - padding.bottom;
    if (scrollHeight <= 0) return;
    const shortPage =
      height >= scrollHeight && attemptedShortPage.current !== progressKey;
    if (!changed && !shortPage) return;
    // Match the old virtual list's origin and total rows, excluding padding.
    const top = Math.max(0, scrollTop - padding.top);
    const threshold = (onEndReachedThreshold ?? 0.2) || 0.5;
    if ((top + height) / scrollHeight >= 1 - threshold) {
      attemptedShortPage.current = progressKey;
      onEndReached();
    }
  }, [
    scrollTop,
    height,
    enabled,
    hasMore,
    isLoadingMore,
    progressKey,
    isFocusedTab,
    onEndReached,
    onEndReachedThreshold,
    padding.top,
    padding.bottom,
    content,
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
  const { owner: scrollElement, isFocused: isFocusedTab } = useWebPagerPage();
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
        hasMore={props.hasMore}
        isLoadingMore={props.isLoadingMore}
        progressKey={`${props.data.length}:${props.data.at(-1)?.id ?? ''}`}
        onEndReached={props.onEndReached}
        onEndReachedThreshold={props.onEndReachedThreshold}
        padding={webContentPadding}
      />
      <FrozenTopHistoryScrollObserver
        enabled={props.frozenTopEnabled}
        onAwayFromTopChange={props.onAwayFromTopChange}
      />
      <WebPagerContent>
        <SharedHistoryList
          {...props}
          webScrollHost={isFocusedTab ? (scrollElement ?? null) : null}
          webContentPadding={webContentPadding}
        />
      </WebPagerContent>
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
