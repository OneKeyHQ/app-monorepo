import { useEffect } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IWsTxsData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseTransactionsWebSocketProps {
  networkId: string;
  tokenAddress: string;
  enabled?: boolean;
  onNewTransaction?: (transaction: IMarketTokenTransaction) => void;
}

export function useTransactionsWebSocket({
  networkId,
  tokenAddress,
  enabled = true,
  onNewTransaction,
}: IUseTransactionsWebSocketProps) {
  // Subscribe to token transactions using existing WebSocket connection
  useEffect(() => {
    if (!enabled || !networkId || !tokenAddress) {
      return;
    }

    const subscribeToTransactions = async () => {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();

        // Use existing WebSocket connection, no need to connect again
        await backgroundApiProxy.serviceMarketWS.subscribeTokenTxs({
          networkId,
          tokenAddress,
        });
      } catch (error) {
        console.error('Failed to subscribe to token transactions:', error);
      }
    };

    void subscribeToTransactions();

    return () => {
      // Clean up token transactions subscription
      const cleanup = async () => {
        try {
          await backgroundApiProxy.serviceMarketWS.unsubscribeTokenTxs({
            networkId,
            tokenAddress,
          });
        } catch (error) {
          console.error(
            'Failed to unsubscribe from token transactions:',
            error,
          );
        }
      };

      void cleanup();
    };
  }, [networkId, tokenAddress, enabled]);

  // Listen for transaction data updates via the app event bus
  useEffect(() => {
    if (!enabled || !onNewTransaction) {
      return;
    }

    const handleTransactionUpdate = (payload: {
      channel: string;
      messageType?: string;
      data: any;
      originalData?: any;
    }) => {
      // Only process transaction messages for our specific token (ignore network matching)
      if (payload.channel === 'tokenTxs') {
        // Convert the received data to IMarketTokenTransaction format
        const transactionData = payload.data as IWsTxsData;

        if (
          transactionData.from?.address !== tokenAddress &&
          transactionData.to?.address !== tokenAddress
        ) {
          return;
        }

        if (transactionData && typeof transactionData === 'object') {
          const fromData = transactionData.from;
          const toData = transactionData.to;

          // Map the received data to the expected transaction format
          const transaction: IMarketTokenTransaction = {
            pairAddress: transactionData.poolId || '',
            hash: transactionData.txHash || '',
            owner: transactionData.owner || '',
            type: (() => {
              if (transactionData.side === 'swap') {
                return fromData?.address === tokenAddress ? 'sell' : 'buy';
              }
              return 'buy';
            })(),
            timestamp: transactionData.blockUnixTime || Date.now() / 1000,
            url: '', // URL not provided in data, could be constructed from txHash
            from: {
              symbol: fromData?.symbol || '',
              amount: BigNumber(fromData?.amount || '0')
                .div(BigNumber(10).pow(fromData?.decimals || 0))
                .toFixed(),
              address: fromData?.address || '',
              price: BigNumber(
                fromData?.price || fromData?.nearestPrice || '0',
              ).toFixed(),
            },
            to: {
              symbol: toData?.symbol || '',
              amount: BigNumber(toData?.amount || '0')
                .div(BigNumber(10).pow(toData?.decimals || 0))
                .toFixed(),
              address: toData?.address || '',
              price: BigNumber(
                toData?.price || toData?.nearestPrice || '0',
              ).toFixed(),
            },
          };

          void backgroundApiProxy.serviceMarketWS.clearDataCount({
            address: tokenAddress,
            type: 'tokenTxs',
          });

          onNewTransaction(transaction);
        }
      }
    };

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
  }, [networkId, tokenAddress, enabled, onNewTransaction]);
}
