import { useCallback, useEffect, useMemo, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import {
  SizableText,
  Spinner,
  Stack,
  Tabs,
  useCurrentTabScrollY,
  useMedia,
} from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EMPTY_MARKET_TRANSACTIONS_REALTIME_PAUSE_STATE,
  useMarketTransactionsRealtimePauseAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { TransactionsRelativeTimeProvider } from './components/TransactionRelativeTime';
import { TransactionsSkeleton } from './components/TransactionsSkeleton';
import { useMarketTransactions } from './hooks/useMarketTransactions';
import { useTransactionsWebSocket } from './hooks/useTransactionsWebSocket';
import { TransactionItemNormal } from './layout/TransactionItemNormal/TransactionItemNormal';
import { TransactionItemSmall } from './layout/TransactionItemSmall/TransactionItemSmall';

import type {
  FlatListProps,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
  onScrollEnd?: () => void;
  scrollEnabled?: boolean;
}

interface ITransactionsHistoryBaseProps extends ITransactionsHistoryProps {
  isTabFocused?: boolean;
}

function getScrollableParent(element: HTMLElement | null) {
  if (!element || platformEnv.isNative) {
    return null;
  }

  let parent = element.parentElement;
  while (parent) {
    const overflowY = globalThis.getComputedStyle(parent).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

const useScrollEnd = platformEnv.isNative
  ? (onScrollEnd: () => void) => {
      const scrollY = useCurrentTabScrollY();

      const debouncedOnScrollEnd = useDebouncedCallback(onScrollEnd, 150);
      useAnimatedReaction(
        () => (scrollY as SharedValue<number>).value,
        (current, prev) => {
          if (current !== prev) {
            runOnJS(debouncedOnScrollEnd)();
          }
        },
        [onScrollEnd],
      );
    }
  : () => {};

export function TransactionsHistoryBase({
  tokenAddress,
  networkId,
  onScrollEnd,
  scrollEnabled = true,
  isTabFocused = true,
}: ITransactionsHistoryBaseProps) {
  const { websocketConfig, isNative } = useTokenDetail();
  const isVisible = useRouteIsFocused();
  const { gtXl } = useMedia();
  const [, setRealtimePauseState] = useMarketTransactionsRealtimePauseAtom();
  const transactionsListRootRef = useRef<HTMLElement | null>(null);
  const didScrollDuringTouchRef = useRef(false);
  const isScrollDraggingRef = useRef(false);
  const isMomentumScrollingRef = useRef(false);
  const hasPendingTouchResumeRef = useRef(false);

  // Enable polling mode for native tokens (which don't have WebSocket support)
  // or for web non-xl screens without WebSocket txs enabled
  const normalMode =
    isNative ||
    (!platformEnv.isNative && !gtXl && !(websocketConfig?.txs ?? false));
  const enableRealtimePause = !normalMode && isVisible;
  const enableHoverRealtimePause = enableRealtimePause && !platformEnv.isNative;
  const enableTouchRealtimePause = enableRealtimePause && platformEnv.isNative;

  const intl = useIntl();
  const {
    transactions,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadMore,
    addNewTransaction,
    bufferedTransactionsCount,
    hasBufferOverflow,
    isRealtimePaused,
    flushBufferedTransactions,
    resumeRealtimeUpdates,
    handleRealtimePauseHoverIn,
    handleRealtimePauseHoverOut,
    handleRealtimePauseTouchStart,
  } = useMarketTransactions({
    tokenAddress,
    networkId,
    normalMode,
    enableRealtimePause,
  });

  // Subscribe to real-time transaction updates
  // Only enable if websocket.txs is enabled and other conditions are met
  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled: !normalMode && isVisible,
    onNewTransaction: addNewTransaction,
  });

  const scrollTransactionsToTop = useCallback(() => {
    if (platformEnv.isNative) {
      return;
    }

    requestAnimationFrame(() => {
      const listRoot = transactionsListRootRef.current;
      const scrollContainer = getScrollableParent(listRoot);
      if (!listRoot || !scrollContainer) {
        return;
      }

      const tabsContainer = listRoot.closest('.onekey-tabs-container');
      const stickyHeader = tabsContainer?.querySelector(
        '.market-transactions-sticky-header',
      ) as HTMLElement | null;
      const headerHeight = stickyHeader?.getBoundingClientRect().height ?? 0;
      const listTop =
        scrollContainer.scrollTop +
        listRoot.getBoundingClientRect().top -
        scrollContainer.getBoundingClientRect().top -
        headerHeight;
      const nextScrollTop = Math.max(0, listTop);

      // The updates pill can be visible before the tab header sticks. In that
      // case, do not advance the page-level scroll and collapse the chart area.
      if (nextScrollTop >= scrollContainer.scrollTop) {
        return;
      }

      scrollContainer.scrollTo({
        top: nextScrollTop,
        behavior: 'auto',
      });
    });
  }, []);

  useEffect(() => {
    setRealtimePauseState((prev) => {
      if (
        prev.isPaused === isRealtimePaused &&
        prev.bufferedCount === bufferedTransactionsCount &&
        prev.hasBufferOverflow === hasBufferOverflow &&
        prev.flushBufferedTransactions === flushBufferedTransactions &&
        prev.resumeRealtimeUpdates === resumeRealtimeUpdates &&
        prev.scrollTransactionsToTop === scrollTransactionsToTop &&
        prev.handleRealtimePauseHoverIn === handleRealtimePauseHoverIn &&
        prev.handleRealtimePauseHoverOut === handleRealtimePauseHoverOut
      ) {
        return prev;
      }
      return {
        isPaused: isRealtimePaused,
        bufferedCount: bufferedTransactionsCount,
        hasBufferOverflow,
        flushBufferedTransactions,
        resumeRealtimeUpdates,
        scrollTransactionsToTop,
        handleRealtimePauseHoverIn,
        handleRealtimePauseHoverOut,
      };
    });
  }, [
    bufferedTransactionsCount,
    flushBufferedTransactions,
    handleRealtimePauseHoverIn,
    handleRealtimePauseHoverOut,
    hasBufferOverflow,
    isRealtimePaused,
    resumeRealtimeUpdates,
    scrollTransactionsToTop,
    setRealtimePauseState,
  ]);

  useEffect(
    () => () => {
      setRealtimePauseState(EMPTY_MARKET_TRANSACTIONS_REALTIME_PAUSE_STATE);
    },
    [setRealtimePauseState],
  );

  const listKey = useMemo(() => {
    return `${networkId}-${tokenAddress}`;
  }, [networkId, tokenAddress]);

  const flushPendingTouchResume = useCallback(() => {
    if (
      !hasPendingTouchResumeRef.current ||
      isScrollDraggingRef.current ||
      isMomentumScrollingRef.current
    ) {
      return;
    }

    hasPendingTouchResumeRef.current = false;
    resumeRealtimeUpdates();
  }, [resumeRealtimeUpdates]);

  const schedulePendingTouchResumeCheck = useCallback(() => {
    if (typeof requestAnimationFrame !== 'function') {
      flushPendingTouchResume();
      return;
    }

    requestAnimationFrame(() => {
      flushPendingTouchResume();
    });
  }, [flushPendingTouchResume]);

  const handleRealtimePauseNativeTouchStart = useCallback(() => {
    didScrollDuringTouchRef.current = false;
    isScrollDraggingRef.current = false;
    isMomentumScrollingRef.current = false;
    hasPendingTouchResumeRef.current = false;
    handleRealtimePauseTouchStart();
  }, [handleRealtimePauseTouchStart]);

  const handleRealtimePauseNativeTouchEnd = useCallback(() => {
    if (!didScrollDuringTouchRef.current) {
      hasPendingTouchResumeRef.current = false;
      resumeRealtimeUpdates();
      return;
    }

    hasPendingTouchResumeRef.current = true;
    schedulePendingTouchResumeCheck();
  }, [resumeRealtimeUpdates, schedulePendingTouchResumeCheck]);

  const handleRealtimePauseNativeScrollBeginDrag = useCallback(() => {
    didScrollDuringTouchRef.current = true;
    isScrollDraggingRef.current = true;
  }, []);

  const handleRealtimePauseNativeScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isScrollDraggingRef.current = false;

      if (!hasPendingTouchResumeRef.current) {
        return;
      }

      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);
      if (velocityY > 0) {
        isMomentumScrollingRef.current = true;
        return;
      }

      schedulePendingTouchResumeCheck();
    },
    [schedulePendingTouchResumeCheck],
  );

  const handleRealtimePauseNativeMomentumScrollBegin = useCallback(() => {
    isScrollDraggingRef.current = false;
    isMomentumScrollingRef.current = true;
  }, []);

  const handleRealtimePauseNativeMomentumScrollEnd = useCallback(() => {
    isMomentumScrollingRef.current = false;
    flushPendingTouchResume();
  }, [flushPendingTouchResume]);

  const renderItem: FlatListProps<IMarketTokenTransaction>['renderItem'] =
    useCallback(
      ({ item, index }: { item: IMarketTokenTransaction; index: number }) => {
        return gtXl ? (
          <TransactionItemNormal
            item={item}
            networkId={networkId}
            index={index}
          />
        ) : (
          <TransactionItemSmall item={item} />
        );
      },
      [networkId, gtXl],
    );

  const keyExtractor = useCallback(
    (item: IMarketTokenTransaction) => item.hash,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);
  const isRelativeTimeTickingEnabled =
    isVisible && isTabFocused && transactions.length > 0;

  useScrollEnd(onScrollEnd ?? noop);

  return (
    <TransactionsRelativeTimeProvider
      isTickingEnabled={isRelativeTimeTickingEnabled}
    >
      <Stack ref={transactionsListRootRef as any} flex={1}>
        <Tabs.FlatList<IMarketTokenTransaction>
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          key={listKey}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          windowSize={platformEnv.isNativeAndroid ? 3 : undefined}
          data={transactions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          {...(enableHoverRealtimePause
            ? {
                onMouseEnter: handleRealtimePauseHoverIn,
                onMouseLeave: handleRealtimePauseHoverOut,
              }
            : undefined)}
          {...(enableTouchRealtimePause
            ? {
                onTouchStart: handleRealtimePauseNativeTouchStart,
                onTouchEnd: handleRealtimePauseNativeTouchEnd,
                onTouchCancel: handleRealtimePauseNativeTouchEnd,
                onScrollBeginDrag: handleRealtimePauseNativeScrollBeginDrag,
                onScrollEndDrag: handleRealtimePauseNativeScrollEndDrag,
                onMomentumScrollBegin:
                  handleRealtimePauseNativeMomentumScrollBegin,
                onMomentumScrollEnd: handleRealtimePauseNativeMomentumScrollEnd,
              }
            : undefined)}
          ListEmptyComponent={
            isRefreshing ? (
              <TransactionsSkeleton />
            ) : (
              <Stack
                flex={1}
                alignItems="center"
                justifyContent="center"
                p="$8"
              >
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_details_nodata,
                  })}
                </SizableText>
              </Stack>
            )
          }
          ListFooterComponent={
            isLoadingMore ? (
              <Stack p="$4" alignItems="center" gap="$2">
                <Spinner size="small" />
              </Stack>
            ) : null
          }
          contentContainerStyle={{
            paddingBottom: platformEnv.isNativeAndroid ? 84 : 16,
          }}
        />
      </Stack>
    </TransactionsRelativeTimeProvider>
  );
}

export function TransactionsHistory(props: ITransactionsHistoryProps) {
  const intl = useIntl();
  const focusedTab = useFocusedTab();
  const transactionsTabName = useMemo(() => {
    return intl.formatMessage({
      id: ETranslations.dexmarket_details_transactions,
    });
  }, [intl]);

  return (
    <TransactionsHistoryBase
      {...props}
      isTabFocused={focusedTab === transactionsTabName}
    />
  );
}
