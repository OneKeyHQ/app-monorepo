import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsTxsData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { mergeUniqueTransactions } from './transactionBufferUtils';

interface IUseTransactionsWebSocketProps {
  networkId: string;
  tokenAddress: string;
  enabled?: boolean;
  currency?: string;
  isPaused?: boolean;
  maxPendingTransactions?: number;
  onNewTransactions?: (transactions: IMarketTokenTransaction[]) => void;
  onSubscriptionRestored?: () => void;
}

interface IMarketWSDataUpdatePayload {
  channel: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  messageType?: string;
  data: unknown;
  originalData?: unknown;
}

const TRANSACTIONS_BATCH_INTERVAL_MS = 1000;

interface IUseTransactionsWebSocketResult {
  pendingTransactionsCount: number;
  hasPendingTransactionsOverflow: boolean;
  flushPendingTransactions: () => void;
}

function formatTransactionAmount(
  amount?: string | number,
  decimals?: number,
): string {
  return BigNumber(amount || '0')
    .div(BigNumber(10).pow(decimals || 0))
    .toFixed();
}

function formatTransactionPrice(
  price?: string | number,
  nearestPrice?: string | number,
): string {
  return BigNumber(price || nearestPrice || '0').toFixed();
}

function matchesTransactionToken(
  transactionData: IWsTxsData,
  tokenAddress: string,
): boolean {
  const txFromAddress = transactionData.from?.address;
  const txToAddress = transactionData.to?.address;

  if (!txFromAddress || !txToAddress) {
    return true;
  }

  return (
    equalsIgnoreCase(txFromAddress, tokenAddress) ||
    equalsIgnoreCase(txToAddress, tokenAddress)
  );
}

function mapTransactionAsset(
  asset: IWsTxsData['from'],
): IMarketTokenTransaction['from'] {
  return {
    symbol: asset?.symbol || '',
    amount: formatTransactionAmount(asset?.amount, asset?.decimals),
    address: asset?.address || '',
    price: formatTransactionPrice(asset?.price, asset?.nearestPrice),
  };
}

function mapTransactionUpdate(
  transactionData: IWsTxsData,
): IMarketTokenTransaction {
  return {
    pairAddress: transactionData.poolId || '',
    hash: transactionData.txHash || '',
    owner: transactionData.owner || '',
    type: transactionData.side === 'sell' ? 'sell' : 'buy',
    timestamp: transactionData.blockUnixTime || Date.now() / 1000,
    url: '',
    poolLogoUrl: transactionData.poolLogoUrl,
    volumeUSD: transactionData.volumeUSD,
    from: mapTransactionAsset(transactionData.from),
    to: mapTransactionAsset(transactionData.to),
  };
}

export function useTransactionsWebSocket({
  networkId,
  tokenAddress,
  enabled = true,
  currency = 'usd',
  isPaused = false,
  maxPendingTransactions,
  onNewTransactions,
  onSubscriptionRestored,
}: IUseTransactionsWebSocketProps): IUseTransactionsWebSocketResult {
  const onNewTransactionsRef = useRef(onNewTransactions);
  const pendingTransactionsRef = useRef<IMarketTokenTransaction[]>([]);
  const hasPendingTransactionsOverflowRef = useRef(false);
  const isPausedRef = useRef(isPaused);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [hasPendingTransactionsOverflow, setHasPendingTransactionsOverflow] =
    useState(false);

  useEffect(() => {
    onNewTransactionsRef.current = onNewTransactions;
  }, [onNewTransactions]);

  const { markSubscriptionActivity } = useMarketWSSubscriptionRecovery({
    enabled,
    networkId,
    tokenAddress,
    currency,
    channel: 'tokenTxs',
    ...(onSubscriptionRestored ? { onRestored: onSubscriptionRestored } : {}),
  });

  useEffect(() => {
    if (!enabled || !networkId || !tokenAddress) {
      return;
    }

    async function subscribeToTransactions(): Promise<void> {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        await backgroundApiProxy.serviceMarketWS.subscribeTokenTxs({
          networkId,
          tokenAddress,
          currency,
        });
      } catch (error) {
        console.error('Failed to subscribe to token transactions:', error);
      }
    }

    void subscribeToTransactions();

    return () => {
      async function unsubscribeFromTransactions(): Promise<void> {
        try {
          await backgroundApiProxy.serviceMarketWS.unsubscribeTokenTxs({
            networkId,
            tokenAddress,
            currency,
          });
        } catch (error) {
          console.error(
            'Failed to unsubscribe from token transactions:',
            error,
          );
        }
      }

      void unsubscribeFromTransactions();
    };
  }, [networkId, tokenAddress, enabled, currency]);

  const clearDataCount = useCallback((): void => {
    void backgroundApiProxy.serviceMarketWS.clearDataCount({
      address: tokenAddress,
      type: 'tokenTxs',
      networkId,
      currency,
    });
  }, [currency, networkId, tokenAddress]);

  const syncPendingTransactionState = useCallback((): void => {
    setPendingTransactionsCount(pendingTransactionsRef.current.length);
    setHasPendingTransactionsOverflow(
      hasPendingTransactionsOverflowRef.current,
    );
  }, []);

  const clearPendingTransactionBatch = useCallback(
    ({ syncState = true }: { syncState?: boolean } = {}): void => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = undefined;
      }
      pendingTransactionsRef.current = [];
      hasPendingTransactionsOverflowRef.current = false;
      if (syncState) {
        syncPendingTransactionState();
      }
    },
    [syncPendingTransactionState],
  );

  const flushPendingTransactionBatch = useCallback(
    ({ force = false }: { force?: boolean } = {}): void => {
      batchTimerRef.current = undefined;

      const transactions = pendingTransactionsRef.current;
      if (transactions.length === 0) {
        syncPendingTransactionState();
        return;
      }

      if (isPausedRef.current && !force) {
        syncPendingTransactionState();
        return;
      }

      pendingTransactionsRef.current = [];
      hasPendingTransactionsOverflowRef.current = false;
      syncPendingTransactionState();
      onNewTransactionsRef.current?.(transactions);
    },
    [syncPendingTransactionState],
  );

  const flushPendingTransactions = useCallback((): void => {
    flushPendingTransactionBatch({ force: true });
  }, [flushPendingTransactionBatch]);

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (!isPaused) {
      flushPendingTransactions();
      return;
    }
    syncPendingTransactionState();
  }, [flushPendingTransactions, isPaused, syncPendingTransactionState]);

  const schedulePendingTransactionBatchFlush = useCallback((): void => {
    if (batchTimerRef.current) {
      return;
    }

    batchTimerRef.current = setTimeout(
      flushPendingTransactionBatch,
      TRANSACTIONS_BATCH_INTERVAL_MS,
    );
  }, [flushPendingTransactionBatch]);

  const handleTransactionUpdate = useCallback(
    (payload: IMarketWSDataUpdatePayload): void => {
      if (payload.channel !== 'tokenTxs') {
        return;
      }

      if (payload.networkId && payload.networkId !== networkId) {
        return;
      }

      if (!payload.networkId && payload.isSubscriptionAmbiguous) {
        return;
      }

      if (!payload.data || typeof payload.data !== 'object') {
        return;
      }

      const transactionData = payload.data as IWsTxsData;
      if (!matchesTransactionToken(transactionData, tokenAddress)) {
        return;
      }

      markSubscriptionActivity();
      clearDataCount();

      const mergedTransactions = mergeUniqueTransactions([
        mapTransactionUpdate(transactionData),
        ...pendingTransactionsRef.current,
      ]);
      const nextPendingTransactions =
        typeof maxPendingTransactions === 'number'
          ? mergedTransactions.slice(0, maxPendingTransactions)
          : mergedTransactions;
      pendingTransactionsRef.current = nextPendingTransactions;
      if (
        typeof maxPendingTransactions === 'number' &&
        mergedTransactions.length > maxPendingTransactions
      ) {
        hasPendingTransactionsOverflowRef.current = true;
      }
      schedulePendingTransactionBatchFlush();
    },
    [
      clearDataCount,
      markSubscriptionActivity,
      tokenAddress,
      networkId,
      maxPendingTransactions,
      schedulePendingTransactionBatchFlush,
    ],
  );

  useEffect(() => {
    if (!enabled || !onNewTransactions) {
      clearPendingTransactionBatch();
      return;
    }

    appEventBus.on(
      EAppEventBusNames.MarketWSDataUpdate,
      handleTransactionUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.MarketWSDataUpdate,
        handleTransactionUpdate,
      );
      clearPendingTransactionBatch({ syncState: false });
    };
  }, [
    clearPendingTransactionBatch,
    enabled,
    onNewTransactions,
    handleTransactionUpdate,
  ]);

  return {
    pendingTransactionsCount,
    hasPendingTransactionsOverflow,
    flushPendingTransactions,
  };
}
