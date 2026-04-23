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

import type { FlatListProps } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

interface ITransactionsHistoryProps {
  tokenAddress: string;
  networkId: string;
  onScrollEnd?: () => void;
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

export function TransactionsHistory({
  tokenAddress,
  networkId,
  onScrollEnd,
}: ITransactionsHistoryProps) {
  const { websocketConfig, isNative } = useTokenDetail();
  const isVisible = useRouteIsFocused();
  const { gtXl } = useMedia();
  const [, setRealtimePauseState] = useMarketTransactionsRealtimePauseAtom();
  const transactionsListRootRef = useRef<HTMLElement | null>(null);

  // Enable polling mode for native tokens (which don't have WebSocket support)
  // or for web non-xl screens without WebSocket txs enabled
  const normalMode =
    isNative ||
    (!platformEnv.isNative && !gtXl && !(websocketConfig?.txs ?? false));
  const enableRealtimePause =
    !normalMode && isVisible && (platformEnv.isNative || gtXl);
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
    resetRealtimePause,
    handleRealtimePauseHoverIn,
    handleRealtimePauseHoverOut,
    handleRealtimePauseTouchStart,
    handleRealtimePauseTouchEnd,
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
    onSubscriptionRestored: resetRealtimePause,
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

      scrollContainer.scrollTo({
        top: Math.max(0, listTop),
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
    isVisible && transactions.length > 0 && !isRealtimePaused;

  useScrollEnd(onScrollEnd ?? noop);

  return (
    <TransactionsRelativeTimeProvider
      isTickingEnabled={isRelativeTimeTickingEnabled}
    >
      <Stack ref={transactionsListRootRef as any} flex={1}>
        <Tabs.FlatList<IMarketTokenTransaction>
          showsVerticalScrollIndicator={false}
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
                onTouchStart: handleRealtimePauseTouchStart,
                onTouchEnd: handleRealtimePauseTouchEnd,
                onTouchCancel: handleRealtimePauseTouchEnd,
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
