import { useCallback, useEffect, useRef, useState } from 'react';

import { useSwapProTokenTransactionPriceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useTransactionsWebSocket } from '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket';
import {
  getSwapProTransactionSource,
  getSwapProTransactionTokenPrice,
  mapHyperliquidTradesToSwapProTransactions,
} from '../utils/swapProTransactionSource';

type ISwapProTokenTransactionListParams = {
  tokenAddress: string;
  networkId: string;
  symbol: string;
  isNative?: boolean;
  enableWebSocket: boolean;
  supportSpeedSwap?: boolean;
};

type ISwapProTransactionFeedResult = {
  feedKey: string;
  list: IMarketTokenTransaction[];
  isError: boolean;
};

type ISwapProTransactionState = {
  feedKey: string;
  list: IMarketTokenTransaction[];
};

const SWAP_PRO_TRANSACTION_LIMIT = 10;

function getTransactionIdentity(transaction: IMarketTokenTransaction) {
  return (
    transaction.hash ||
    `${transaction.timestamp}:${transaction.type}:${transaction.from.amount}:${transaction.to.amount}`
  );
}

function mergeTransactions(
  ...transactionLists: IMarketTokenTransaction[][]
): IMarketTokenTransaction[] {
  const seen = new Set<string>();
  const merged: IMarketTokenTransaction[] = [];

  for (const transactions of transactionLists) {
    for (const transaction of transactions) {
      const identity = getTransactionIdentity(transaction);
      if (!seen.has(identity)) {
        seen.add(identity);
        merged.push(transaction);
      }
    }
  }

  return merged
    .toSorted((a, b) => b.timestamp - a.timestamp)
    .slice(0, SWAP_PRO_TRANSACTION_LIMIT);
}

function useSwapProTransactionFeed({
  tokenAddress,
  networkId,
  symbol,
  isNative,
  supportSpeedSwap,
}: Omit<ISwapProTokenTransactionListParams, 'enableWebSocket'>) {
  const transactionSource = getSwapProTransactionSource({
    token: {
      contractAddress: tokenAddress,
      networkId,
      symbol,
      isNative,
    },
    supportSpeedSwap,
  });
  const feedKey = [
    transactionSource ?? 'none',
    networkId,
    tokenAddress,
    symbol,
    isNative ? 'native' : 'token',
  ].join(':');
  const { result: feedResult } =
    usePromiseResult<ISwapProTransactionFeedResult>(
      async () => {
        if (!networkId || !transactionSource) {
          return {
            feedKey,
            list: [],
            isError: false,
          };
        }
        try {
          if (transactionSource === 'hyperliquid') {
            const trades =
              await backgroundApiProxy.serviceHyperliquid.getPerpRecentTrades({
                coin: 'BTC',
              });
            return {
              feedKey,
              list: mapHyperliquidTradesToSwapProTransactions(trades).slice(
                0,
                SWAP_PRO_TRANSACTION_LIMIT,
              ),
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
            list: response.list,
            isError: false,
          };
        } catch (_error) {
          return {
            feedKey,
            list: [],
            isError: true,
          };
        }
      },
      [feedKey, networkId, tokenAddress, transactionSource],
      {
        pollingInterval:
          transactionSource === 'hyperliquid'
            ? timerUtils.getTimeDurationMs({ seconds: 3 })
            : undefined,
      },
    );

  return {
    feedKey,
    feedResult,
    transactionSource,
    hasLoadedTransactionSource: feedResult?.feedKey === feedKey,
  };
}

export function useSwapProTokenTransactionList({
  tokenAddress,
  networkId,
  symbol,
  isNative,
  enableWebSocket,
  supportSpeedSwap,
}: ISwapProTokenTransactionListParams) {
  const currencyInfo = useCurrency();
  const [, setSwapProTokenTransactionPrice] =
    useSwapProTokenTransactionPriceAtom();
  const { feedKey, feedResult, transactionSource, hasLoadedTransactionSource } =
    useSwapProTransactionFeed({
      tokenAddress,
      networkId,
      symbol,
      isNative,
      supportSpeedSwap,
    });
  const [transactionState, setTransactionState] =
    useState<ISwapProTransactionState>({
      feedKey,
      list: [],
    });
  const currentTransactionState: ISwapProTransactionState =
    transactionState.feedKey === feedKey
      ? transactionState
      : { feedKey, list: [] };
  const currentTransactionStateRef = useRef(currentTransactionState);
  const activeFeedKeyRef = useRef(feedKey);
  currentTransactionStateRef.current = currentTransactionState;
  activeFeedKeyRef.current = feedKey;

  useEffect(() => {
    setSwapProTokenTransactionPrice('');
  }, [feedKey, setSwapProTokenTransactionPrice]);

  useEffect(() => {
    if (
      feedResult?.feedKey !== feedKey ||
      feedResult.isError ||
      activeFeedKeyRef.current !== feedKey
    ) {
      return;
    }

    const nextTransactions =
      transactionSource === 'market'
        ? mergeTransactions(
            feedResult.list,
            currentTransactionStateRef.current.list,
          )
        : feedResult.list;
    const nextState = {
      feedKey,
      list: nextTransactions,
    };
    currentTransactionStateRef.current = nextState;
    setTransactionState(nextState);
    if (transactionSource === 'market') {
      setSwapProTokenTransactionPrice(
        nextTransactions[0]
          ? getSwapProTransactionTokenPrice(nextTransactions[0])
          : '',
      );
    }
  }, [feedKey, feedResult, setSwapProTokenTransactionPrice, transactionSource]);

  const handleNewTransactions = useCallback(
    (newTransactions: IMarketTokenTransaction[]) => {
      if (
        newTransactions.length === 0 ||
        activeFeedKeyRef.current !== feedKey
      ) {
        return;
      }

      const previousState = currentTransactionStateRef.current;
      const previousTransactions =
        previousState.feedKey === feedKey ? previousState.list : [];
      const seenTransactions = new Set(
        previousTransactions.map(getTransactionIdentity),
      );
      const uniqueNewTransactions = newTransactions.filter(
        (transaction) =>
          !seenTransactions.has(getTransactionIdentity(transaction)),
      );
      if (uniqueNewTransactions.length === 0) {
        return;
      }

      const updatedTransactions = mergeTransactions(
        uniqueNewTransactions,
        previousTransactions,
      );
      const nextState = {
        feedKey,
        list: updatedTransactions,
      };
      currentTransactionStateRef.current = nextState;
      setTransactionState(nextState);
      setSwapProTokenTransactionPrice(
        getSwapProTransactionTokenPrice(updatedTransactions[0]),
      );
    },
    [feedKey, setSwapProTokenTransactionPrice],
  );

  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled: enableWebSocket && transactionSource === 'market',
    currency: currencyInfo.id,
    maxPendingTransactions: SWAP_PRO_TRANSACTION_LIMIT,
    onNewTransactions: handleNewTransactions,
  });

  return {
    swapProTokenTransactionList: currentTransactionState.list,
    isTransactionSourceSupported: Boolean(transactionSource),
    isHyperliquidTransactionSource: transactionSource === 'hyperliquid',
    hasLoadedTransactionSource,
  };
}
