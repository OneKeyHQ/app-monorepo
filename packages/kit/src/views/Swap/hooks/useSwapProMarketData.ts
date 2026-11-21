import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';
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

const swapProMarketDataCache = new LRUCache<string, ISwapProMarketDataState>({
  max: 20,
});
const MARKET_TRANSACTIONS_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({
  seconds: 5,
});
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
  const cachedFeedState = swapProMarketDataCache.get(feedKey);
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
    hasLoadedSource:
      feedResult?.feedKey === feedKey || cachedFeedState !== undefined,
  };
}

function useSwapProMarketDataState({
  feedKey,
  feedResult,
}: {
  feedKey: string;
  feedResult: ISwapProMarketDataFeedResult | undefined;
}) {
  const [marketDataState, setMarketDataState] =
    useState<ISwapProMarketDataState>(
      () =>
        swapProMarketDataCache.get(feedKey) ?? {
          feedKey,
          transactions: [],
        },
    );
  const currentMarketDataState: ISwapProMarketDataState =
    marketDataState.feedKey === feedKey
      ? marketDataState
      : (swapProMarketDataCache.get(feedKey) ?? {
          feedKey,
          transactions: [],
        });
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
    swapProMarketDataCache.set(feedKey, nextState);
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
      swapProMarketDataCache.set(feedKey, nextState);
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
  useEffect(() => {
    if (enabled && source === 'hyperliquid') {
      return watchHyperliquidPublicTrades({
        coin: 'BTC',
        onTrades: (trades) => {
          handleNewTransactions(
            mapHyperliquidTradesToSwapProTransactions(trades),
          );
        },
      });
    }
  }, [enabled, source, handleNewTransactions]);

  return useMemo(() => {
    return buildSwapProMarketData({
      source,
      transactions,
      marketSnapshotPrice,
      hasLoadedSource,
    });
  }, [transactions, hasLoadedSource, marketSnapshotPrice, source]);
}
