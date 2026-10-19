import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, getTokenValue, useStyle } from '@onekeyhq/components';
import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';
import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  } = useAppPagerPage();
  const previousScrollTop = useRef(scrollTop);
  const intl = useIntl();
  const attempt = useRef({ key: progressKey, count: 0, token: 0 });
  const mounted = useRef(false);
  const pending = useRef(false);
  const [requestPending, setRequestPending] = useState(false);
  const completedRequest = useRef({ key: '', token: 0 });
  const [settled, setSettled] = useState(completedRequest.current);
  const [manualRetry, setManualRetry] = useState(0);
  const handledRetry = useRef(0);
  useEffect(() => {
    mounted.current = true;
    setRequestPending(pending.current);
    setSettled(completedRequest.current);
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const changed = previousScrollTop.current !== scrollTop;
    previousScrollTop.current = scrollTop;
    if (attempt.current.key !== progressKey) {
      attempt.current = {
        key: progressKey,
        count: 0,
        token: attempt.current.token + 1,
      };
      pending.current = false;
      setRequestPending(false);
    }
    if (
      !enabled ||
      !isFocusedTab ||
      !onEndReached ||
      !hasMore ||
      isLoadingMore ||
      pending.current
    )
      return;
    const scrollHeight =
      (content?.scrollHeight ?? 0) - padding.top - padding.bottom;
    if (scrollHeight <= 0) return;
    const completed =
      settled.key === progressKey && settled.token === attempt.current.token;
    const retryRequested = manualRetry !== handledRetry.current;
    const shortPage =
      height >= scrollHeight &&
      (attempt.current.count === 0 || (completed && attempt.current.count < 2));
    if (
      (!changed && !shortPage && !retryRequested) ||
      (attempt.current.count >= 2 && !retryRequested)
    )
      return;
    // Match the old virtual list's origin and total rows, excluding padding.
    const top = Math.max(0, scrollTop - padding.top);
    const threshold = (onEndReachedThreshold ?? 0.2) || 0.5;
    if ((top + height) / scrollHeight >= 1 - threshold) {
      handledRetry.current = manualRetry;
      attempt.current.count += 1;
      attempt.current.token += 1;
      const token = attempt.current.token;
      pending.current = true;
      setRequestPending(true);
      const complete = () => {
        if (token !== attempt.current.token) return;
        pending.current = false;
        completedRequest.current = { key: progressKey, token };
        if (mounted.current) {
          setRequestPending(false);
          setSettled(completedRequest.current);
        }
      };
      try {
        const result = onEndReached();
        void Promise.resolve(result).then(complete, complete);
      } catch {
        complete();
      }
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
    settled,
    manualRetry,
  ]);
  if (
    enabled &&
    isFocusedTab &&
    hasMore &&
    settled.key === progressKey &&
    attempt.current.count >= 2
  ) {
    return (
      <Button
        alignSelf="center"
        my="$3"
        variant="tertiary"
        testID="history-pagination-retry"
        disabled={requestPending || isLoadingMore}
        onPress={() => {
          if (!pending.current && !isLoadingMore)
            setManualRetry((value) => value + 1);
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    );
  }
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
  const { owner: scrollElement, isFocused: isFocusedTab } = useAppPagerPage();
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
      <FrozenTopHistoryScrollObserver
        enabled={props.frozenTopEnabled}
        onAwayFromTopChange={props.onAwayFromTopChange}
      />
      <AppPagerContent>
        <SharedHistoryList
          {...props}
          webScrollHost={isFocusedTab ? (scrollElement ?? null) : null}
          webContentPadding={webContentPadding}
        />
        <WebHistoryPaginationObserver
          enabled={!!props.initialized && props.data.length > 0}
          hasMore={props.hasMore}
          isLoadingMore={props.isLoadingMore}
          progressKey={`${props.data.length}:${props.data.at(-1)?.id ?? ''}`}
          onEndReached={props.onEndReached}
          onEndReachedThreshold={props.onEndReachedThreshold}
          padding={webContentPadding}
        />
      </AppPagerContent>
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
