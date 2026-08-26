import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useTransactionsWebSocket } from '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket';
import {
  SWAP_PRO_TRANSACTION_LIMIT,
  buildSwapProMarketData,
  mergeSwapProTransactions,
} from '../utils/swapProMarketDataUtils';
import {
  getSwapProMarketDataSource,
  mapHyperliquidTradesToSwapProTransactions,
} from '../utils/swapProTransactionSource';

import type { ISwapProMarketData } from '../utils/swapProMarketDataUtils';
import type { ISwapProMarketTransaction } from '../utils/swapProTransactionSource';

type ISwapProMarketDataParams = {
  tokenAddress: string;
  networkId: string;
  symbol: string;
  isNative?: boolean;
  enabled: boolean;
  enableMarketWebSocket: boolean;
  marketSnapshotPrice?: string;
};

type ISwapProMarketDataFeedResult = {
  feedKey: string;
  transactions: ISwapProMarketTransaction[];
  isError: boolean;
};

type ISwapProMarketDataState = {
  feedKey: string;
  transactions: ISwapProMarketTransaction[];
};

const MARKET_TRANSACTIONS_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({
  seconds: 5,
});
const HYPERLIQUID_SUBSCRIPTION_RETRY_BASE_DELAY_MS =
  timerUtils.getTimeDurationMs({ seconds: 1 });
const HYPERLIQUID_SUBSCRIPTION_RETRY_MAX_DELAY_MS =
  timerUtils.getTimeDurationMs({ seconds: 30 });

function useSwapProMarketDataFeed({
  tokenAddress,
  networkId,
  symbol,
  isNative,
  enabled,
  enableMarketWebSocket,
}: Omit<ISwapProMarketDataParams, 'marketSnapshotPrice'>) {
  const source = getSwapProMarketDataSource({
    token: {
      contractAddress: tokenAddress,
      networkId,
      symbol,
      isNative,
    },
  });
  const feedKey = [
    source ?? 'none',
    networkId,
    tokenAddress,
    symbol,
    isNative ? 'native' : 'token',
  ].join(':');
  const canUseMarketWebSocket = Boolean(
    source === 'market' && enableMarketWebSocket && tokenAddress,
  );
  const { result: feedResult } = usePromiseResult<ISwapProMarketDataFeedResult>(
    async () => {
      if (!enabled || !networkId || !source) {
        return {
          feedKey,
          transactions: [],
          isError: false,
        };
      }
      try {
        if (source === 'hyperliquid') {
          const trades =
            await backgroundApiProxy.serviceHyperliquid.getPerpRecentTrades({
              coin: 'BTC',
            });
          return {
            feedKey,
            transactions: mapHyperliquidTradesToSwapProTransactions(trades),
            isError: false,
          };
        }
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions(
            {
              tokenAddress,
              networkId,
              limit: SWAP_PRO_TRANSACTION_LIMIT,
            },
          );
        return {
          feedKey,
          transactions: response.list,
          isError: false,
        };
      } catch (_error) {
        return {
          feedKey,
          transactions: [],
          isError: true,
        };
      }
    },
    [enabled, feedKey, networkId, source, tokenAddress],
    {
      overrideIsFocused: (isFocused) => isFocused && enabled,
      pollingInterval:
        source === 'market' && !canUseMarketWebSocket
          ? MARKET_TRANSACTIONS_POLLING_INTERVAL_MS
          : undefined,
      revalidateOnReconnect: source === 'hyperliquid',
    },
  );

  return {
    feedKey,
    feedResult,
    source,
    hasLoadedSource: feedResult?.feedKey === feedKey,
  };
}

function useHyperliquidTradesWebSocket({
  coin,
  enabled,
  onNewTransactions,
}: {
  coin: string;
  enabled: boolean;
  onNewTransactions: (transactions: ISwapProMarketTransaction[]) => void;
}) {
  const onNewTransactionsRef = useRef(onNewTransactions);
  onNewTransactionsRef.current = onNewTransactions;

  useEffect(() => {
    if (!enabled || !coin) {
      return;
    }

    const handleHyperliquidDataUpdate = (
      payload: IAppEventBusPayload[EAppEventBusNames.HyperliquidDataUpdate],
    ) => {
      if (
        payload.subType !== ESubscriptionType.TRADES ||
        !Array.isArray(payload.data)
      ) {
        return;
      }

      const trades = (payload.data as IWsTrades).filter(
        (trade) => trade.coin === coin,
      );
      if (trades.length === 0) {
        return;
      }

      onNewTransactionsRef.current(
        mapHyperliquidTradesToSwapProTransactions(trades),
      );
    };

    appEventBus.on(
      EAppEventBusNames.HyperliquidDataUpdate,
      handleHyperliquidDataUpdate,
    );
    let disposed = false;
    let subscriptionAcquired = false;
    let subscriptionRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let subscriptionRetryAttempt = 0;
    const releaseSubscription = () => {
      if (!subscriptionAcquired) {
        return;
      }
      subscriptionAcquired = false;
      void backgroundApiProxy.serviceHyperliquidSubscription
        .unsubscribePublicTrades({ coin })
        .catch((error) => {
          console.error(
            'Failed to unsubscribe from Hyperliquid public trades:',
            error,
          );
        });
    };
    const subscribe = () => {
      void backgroundApiProxy.serviceHyperliquidSubscription
        .subscribePublicTrades({ coin })
        .then(() => {
          subscriptionAcquired = true;
          if (disposed) {
            releaseSubscription();
          }
        })
        .catch((error) => {
          console.error(
            'Failed to subscribe to Hyperliquid public trades:',
            error,
          );
          if (disposed) {
            return;
          }
          const retryDelay = Math.min(
            HYPERLIQUID_SUBSCRIPTION_RETRY_BASE_DELAY_MS *
              2 ** subscriptionRetryAttempt,
            HYPERLIQUID_SUBSCRIPTION_RETRY_MAX_DELAY_MS,
          );
          subscriptionRetryAttempt += 1;
          subscriptionRetryTimer = setTimeout(subscribe, retryDelay);
        });
    };
    subscribe();

    return () => {
      disposed = true;
      if (subscriptionRetryTimer) {
        clearTimeout(subscriptionRetryTimer);
      }
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleHyperliquidDataUpdate,
      );
      releaseSubscription();
    };
  }, [coin, enabled]);
}

function useSwapProMarketDataState({
  feedKey,
  feedResult,
}: {
  feedKey: string;
  feedResult: ISwapProMarketDataFeedResult | undefined;
}) {
  const [marketDataState, setMarketDataState] =
    useState<ISwapProMarketDataState>({
      feedKey,
      transactions: [],
    });
  const currentMarketDataState: ISwapProMarketDataState =
    marketDataState.feedKey === feedKey
      ? marketDataState
      : { feedKey, transactions: [] };
  const currentMarketDataStateRef = useRef(currentMarketDataState);
  const activeFeedKeyRef = useRef(feedKey);
  currentMarketDataStateRef.current = currentMarketDataState;
  activeFeedKeyRef.current = feedKey;

  useEffect(() => {
    if (
      feedResult?.feedKey !== feedKey ||
      feedResult.isError ||
      activeFeedKeyRef.current !== feedKey
    ) {
      return;
    }

    const nextState = {
      feedKey,
      transactions: mergeSwapProTransactions(
        feedResult.transactions,
        currentMarketDataStateRef.current.transactions,
      ),
    };
    currentMarketDataStateRef.current = nextState;
    setMarketDataState(nextState);
  }, [feedKey, feedResult]);

  const handleNewTransactions = useCallback(
    (newTransactions: ISwapProMarketTransaction[]) => {
      if (
        newTransactions.length === 0 ||
        activeFeedKeyRef.current !== feedKey
      ) {
        return;
      }

      const previousState = currentMarketDataStateRef.current;
      const previousTransactions =
        previousState.feedKey === feedKey ? previousState.transactions : [];
      const nextState = {
        feedKey,
        transactions: mergeSwapProTransactions(
          newTransactions,
          previousTransactions,
        ),
      };
      currentMarketDataStateRef.current = nextState;
      setMarketDataState(nextState);
    },
    [feedKey],
  );

  return {
    transactions: currentMarketDataState.transactions,
    handleNewTransactions,
  };
}

export function useSwapProMarketData({
  tokenAddress,
  networkId,
  symbol,
  isNative,
  enabled,
  enableMarketWebSocket,
  marketSnapshotPrice,
}: ISwapProMarketDataParams): ISwapProMarketData {
  const currencyInfo = useCurrency();
  const { feedKey, feedResult, source, hasLoadedSource } =
    useSwapProMarketDataFeed({
      tokenAddress,
      networkId,
      symbol,
      isNative,
      enabled,
      enableMarketWebSocket,
    });
  const { transactions, handleNewTransactions } = useSwapProMarketDataState({
    feedKey,
    feedResult,
  });

  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled:
      enabled &&
      source === 'market' &&
      enableMarketWebSocket &&
      Boolean(tokenAddress),
    currency: currencyInfo.id,
    maxPendingTransactions: SWAP_PRO_TRANSACTION_LIMIT,
    onNewTransactions: handleNewTransactions,
  });
  useHyperliquidTradesWebSocket({
    coin: 'BTC',
    enabled: enabled && source === 'hyperliquid',
    onNewTransactions: handleNewTransactions,
  });

  return useMemo(() => {
    return buildSwapProMarketData({
      source,
      transactions,
      marketSnapshotPrice,
      hasLoadedSource,
    });
  }, [transactions, hasLoadedSource, marketSnapshotPrice, source]);
}
