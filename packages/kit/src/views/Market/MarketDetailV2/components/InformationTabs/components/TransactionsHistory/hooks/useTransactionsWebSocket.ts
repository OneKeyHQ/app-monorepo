import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
      networkId: string;
      tokenAddress: string;
      messageType?: string;
      data: any;
      originalData?: any;
    }) => {
      // Only process transaction messages for our specific token (ignore network matching)
      if (
        payload.channel === 'tokenTxs' &&
        payload.tokenAddress === tokenAddress
      ) {
        // Convert the received data to IMarketTokenTransaction format
        const transactionData = payload.data as Record<string, any>;

        if (transactionData && typeof transactionData === 'object') {
          // Helper function to safely get nested property
          const safeGetNested = (obj: any, path: string): string => {
            const keys = path.split('.');
            let current = obj;
            for (const key of keys) {
              if (current && typeof current === 'object' && key in current) {
                current = (current as Record<string, any>)[key];
              } else {
                return '';
              }
            }
            // Convert to string for all types
            if (current === null || current === undefined) {
              return '';
            }
            return String(current);
          };

          // Map the received data to the expected transaction format
          const transaction: IMarketTokenTransaction = {
            pairAddress:
              typeof transactionData.poolId === 'string'
                ? transactionData.poolId
                : '',
            hash:
              typeof transactionData.txHash === 'string'
                ? transactionData.txHash
                : '',
            owner:
              typeof transactionData.owner === 'string'
                ? transactionData.owner
                : '',
            type: (() => {
              if (transactionData.side === 'swap') {
                return safeGetNested(transactionData, 'from.symbol') !== 'SOL'
                  ? 'sell'
                  : 'buy';
              }
              return 'buy';
            })(),
            timestamp:
              typeof transactionData.blockUnixTime === 'number'
                ? transactionData.blockUnixTime
                : Date.now() / 1000,
            url: '', // URL not provided in data, could be constructed from txHash
            from: {
              symbol: safeGetNested(transactionData, 'from.symbol'),
              amount: safeGetNested(transactionData, 'from.amount') || '0',
              address: safeGetNested(transactionData, 'from.address'),
              price: safeGetNested(transactionData, 'from.price') || '0',
            },
            to: {
              symbol: safeGetNested(transactionData, 'to.symbol'),
              amount: safeGetNested(transactionData, 'to.amount') || '0',
              address: safeGetNested(transactionData, 'to.address'),
              price: safeGetNested(transactionData, 'to.price') || '0',
            },
          };

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
