import { useCallback, useEffect } from 'react';

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

interface IUseTransactionsWebSocketProps {
  networkId: string;
  tokenAddress: string;
  enabled?: boolean;
  currency?: string;
  onNewTransaction?: (transaction: IMarketTokenTransaction) => void;
  onSubscriptionRestored?: () => void;
}

interface IMarketWSDataUpdatePayload {
  channel: string;
  messageType?: string;
  data: unknown;
  originalData?: unknown;
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
  onNewTransaction,
  onSubscriptionRestored,
}: IUseTransactionsWebSocketProps): void {
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

  const handleTransactionUpdate = useCallback(
    (payload: IMarketWSDataUpdatePayload): void => {
      if (payload.channel !== 'tokenTxs') {
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

      void backgroundApiProxy.serviceMarketWS.clearDataCount({
        address: tokenAddress,
        type: 'tokenTxs',
      });

      onNewTransaction?.(mapTransactionUpdate(transactionData));
    },
    [markSubscriptionActivity, onNewTransaction, tokenAddress],
  );

  useEffect(() => {
    if (!enabled || !onNewTransaction) {
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
    };
  }, [enabled, onNewTransaction, handleTransactionUpdate]);
}
