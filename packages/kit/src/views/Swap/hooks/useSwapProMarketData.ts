import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useTransactionsWebSocket } from '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket';
import {
  buildSwapProMarketData,
  mergeSwapProTransactions,
} from '../utils/swapProMarketDataUtils';
import {
  getSwapProMarketDataSource,
  mapHyperliquidTradesToSwapProTransactions,
} from '../utils/swapProTransactionSource';

import type { ISwapProMarketData } from '../utils/swapProMarketDataUtils';

type ISwapProMarketDataParams = {
  tokenAddress: string;
  networkId: string;
  symbol: string;
  isNative?: boolean;
  enableMarketWebSocket: boolean;
  marketSnapshotPrice?: string;
  supportSpeedSwap?: boolean;
};

type ISwapProMarketDataFeedResult = {
  feedKey: string;
  transactions: IMarketTokenTransaction[];
  isError: boolean;
};

type ISwapProMarketDataState = {
  feedKey: string;
  transactions: IMarketTokenTransaction[];
};

const SWAP_PRO_TRANSACTION_LIMIT = 10;
const HYPERLIQUID_TRADES_BATCH_INTERVAL_MS = 1000;
const MARKET_TRANSACTIONS_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({
  seconds: 5,
});

function useSwapProMarketDataFeed({
  tokenAddress,
  networkId,
  symbol,
  isNative,
  enableMarketWebSocket,
  supportSpeedSwap,
}: Omit<ISwapProMarketDataParams, 'marketSnapshotPrice'>) {
  const source = getSwapProMarketDataSource({
    token: {
      contractAddress: tokenAddress,
      networkId,
      symbol,
      isNative,
    },
    supportSpeedSwap,
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
      if (!networkId || !source) {
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
    [feedKey, networkId, source, tokenAddress],
    source === 'market' && !canUseMarketWebSocket
      ? { pollingInterval: MARKET_TRANSACTIONS_POLLING_INTERVAL_MS }
      : undefined,
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
  onNewTransactions: (transactions: IMarketTokenTransaction[]) => void;
}) {
  const onNewTransactionsRef = useRef(onNewTransactions);
  onNewTransactionsRef.current = onNewTransactions;

  useEffect(() => {
    if (!enabled || !coin) {
      return;
    }

    let pendingTransactions: IMarketTokenTransaction[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | undefined;

    const flushPendingTransactions = () => {
      batchTimer = undefined;
      if (pendingTransactions.length === 0) {
        return;
      }
      const transactions = pendingTransactions;
      pendingTransactions = [];
      onNewTransactionsRef.current(transactions);
    };

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

      pendingTransactions = mergeSwapProTransactions(
        mapHyperliquidTradesToSwapProTransactions(trades),
        pendingTransactions,
      );
      if (!batchTimer) {
        batchTimer = setTimeout(
          flushPendingTransactions,
          HYPERLIQUID_TRADES_BATCH_INTERVAL_MS,
        );
      }
    };

    appEventBus.on(
      EAppEventBusNames.HyperliquidDataUpdate,
      handleHyperliquidDataUpdate,
    );
    void backgroundApiProxy.serviceHyperliquidSubscription
      .subscribePublicTrades({ coin })
      .catch((error) => {
        console.error(
          'Failed to subscribe to Hyperliquid public trades:',
          error,
        );
      });

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleHyperliquidDataUpdate,
      );
      if (batchTimer) {
        clearTimeout(batchTimer);
      }
      void backgroundApiProxy.serviceHyperliquidSubscription
        .unsubscribePublicTrades({ coin })
        .catch((error) => {
          console.error(
            'Failed to unsubscribe from Hyperliquid public trades:',
            error,
          );
        });
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
    (newTransactions: IMarketTokenTransaction[]) => {
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
  enableMarketWebSocket,
  marketSnapshotPrice,
  supportSpeedSwap,
}: ISwapProMarketDataParams): ISwapProMarketData {
  const currencyInfo = useCurrency();
  const { feedKey, feedResult, source, hasLoadedSource } =
    useSwapProMarketDataFeed({
      tokenAddress,
      networkId,
      symbol,
      isNative,
      enableMarketWebSocket,
      supportSpeedSwap,
    });
  const { transactions, handleNewTransactions } = useSwapProMarketDataState({
    feedKey,
    feedResult,
  });

  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled:
      source === 'market' && enableMarketWebSocket && Boolean(tokenAddress),
    currency: currencyInfo.id,
    maxPendingTransactions: SWAP_PRO_TRANSACTION_LIMIT,
    onNewTransactions: handleNewTransactions,
  });
  useHyperliquidTradesWebSocket({
    coin: 'BTC',
    enabled: source === 'hyperliquid',
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
