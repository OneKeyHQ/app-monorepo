import { useCallback, useEffect } from 'react';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWalletType } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EAmountEnterType,
  ERouter,
  ESlippageSetting,
  ESwapType,
} from '@onekeyhq/shared/src/logger/scopes/dex/types';
import type { IDexSwapParams } from '@onekeyhq/shared/src/logger/scopes/dex/types';

import {
  getCompleteSwapAnalyticsAtom,
  resetSwapAnalyticsAtom,
  swapAnalyticsAtom,
  updateSwapAnalyticsAtom,
} from '../atoms/swapAnalytics';

import { ESwapDirection, type ITradeType } from './useTradeType';

import type { IToken } from '../types';
import type { IAmountEnterSource } from '../types/analytics';

export function useSwapAnalytics() {
  const [analyticsState] = useAtom(swapAnalyticsAtom);
  const updateAnalytics = useSetAtom(updateSwapAnalyticsAtom);
  const resetAnalytics = useSetAtom(resetSwapAnalyticsAtom);
  const completeAnalytics = useAtomValue(getCompleteSwapAnalyticsAtom);
  const { activeAccount } = useActiveAccount({ num: 0 });

  // Get wallet type
  const getWalletType = useCallback((): IDBWalletType | undefined => {
    return activeAccount?.wallet?.type;
  }, [activeAccount?.wallet?.type]);

  // Set amount enter type
  const setAmountEnterType = useCallback(
    (source: IAmountEnterSource) => {
      let amountEnterType: EAmountEnterType;
      switch (source) {
        case 'preset1':
          amountEnterType = EAmountEnterType.Preset1;
          break;
        case 'preset2':
          amountEnterType = EAmountEnterType.Preset2;
          break;
        case 'preset3':
          amountEnterType = EAmountEnterType.Preset3;
          break;
        case 'preset4':
          amountEnterType = EAmountEnterType.Preset4;
          break;
        default:
          amountEnterType = EAmountEnterType.Manual;
      }
      updateAnalytics({ amountEnterType });
    },
    [updateAnalytics],
  );

  // Set slippage setting
  const setSlippageSetting = useCallback(
    (isManual: boolean) => {
      const slippageSetting = isManual
        ? ESlippageSetting.Manual
        : ESlippageSetting.Auto;
      updateAnalytics({
        slippageSetting,
      });
    },
    [updateAnalytics],
  );

  // Set token information
  const setTokenInfo = useCallback(
    ({
      tradeType: currentTradeType,
      marketToken,
      paymentToken: currentPaymentToken,
    }: {
      tradeType: ITradeType;
      marketToken?: { symbol: string };
      paymentToken?: IToken;
    }) => {
      const sourceTokenSymbol =
        currentTradeType === ESwapDirection.BUY
          ? currentPaymentToken?.symbol ?? ''
          : marketToken?.symbol ?? '';
      const receivedTokenSymbol =
        currentTradeType === ESwapDirection.BUY
          ? marketToken?.symbol ?? ''
          : currentPaymentToken?.symbol ?? '';

      updateAnalytics({
        sourceTokenSymbol,
        receivedTokenSymbol,
      });
    },
    [updateAnalytics],
  );

  // Set network information
  const setNetwork = useCallback(
    (currentNetworkId: string) => {
      updateAnalytics({ network: currentNetworkId });
    },
    [updateAnalytics],
  );

  // Set swap type
  const setSwapType = useCallback(
    (currentTradeType: ITradeType) => {
      const swapType =
        currentTradeType === ESwapDirection.BUY
          ? ESwapType.Buy
          : ESwapType.Sell;
      updateAnalytics({
        swapType,
      });
    },
    [updateAnalytics],
  );

  // Set router
  const setRouter = useCallback(
    (router: ERouter = ERouter.OKX) => {
      updateAnalytics({ router });
    },
    [updateAnalytics],
  );

  // Submit log with error handling
  const logSwapAction = useCallback(
    (params?: {
      tradeType?: ITradeType;
      networkId?: string;
      paymentToken?: IToken;
      balanceToken?: IToken;
    }) => {
      try {
        // Update environment if params provided
        if (params) {
          const { tradeType, networkId, paymentToken, balanceToken } = params;
          if (networkId && (paymentToken || balanceToken) && tradeType) {
            const marketToken = {
              symbol: balanceToken?.symbol || '',
            };

            const sourceTokenSymbol =
              tradeType === ESwapDirection.BUY
                ? paymentToken?.symbol ?? ''
                : marketToken.symbol;
            const receivedTokenSymbol =
              tradeType === ESwapDirection.BUY
                ? marketToken.symbol
                : paymentToken?.symbol ?? '';

            const walletType = getWalletType();
            if (walletType) {
              updateAnalytics({
                walletType,
                sourceTokenSymbol,
                receivedTokenSymbol,
                network: networkId,
                swapType:
                  tradeType === ESwapDirection.BUY
                    ? ESwapType.Buy
                    : ESwapType.Sell,
                router: ERouter.OKX,
              });
            }
          }
        }

        // Get the latest analytics data after potential update
        const currentAnalytics = completeAnalytics;
        if (currentAnalytics && currentAnalytics.walletType) {
          // Use ISwapAnalyticsData directly as IDexSwapParams
          const dexSwapParams: IDexSwapParams = currentAnalytics;
          defaultLogger.dex.swap.dexSwap(dexSwapParams);
        }
      } catch (error) {
        // Silently handle analytics errors to not affect main functionality
        console.warn('Analytics logging failed:', error);
      }
    },
    [completeAnalytics, getWalletType, updateAnalytics],
  );

  // Cleanup analytics state on unmount
  useEffect(() => {
    return () => {
      resetAnalytics();
    };
  }, [resetAnalytics]);

  return {
    // State
    analyticsState,
    completeAnalytics,
    isReady: !!completeAnalytics,

    // Setter methods
    setAmountEnterType,
    setSlippageSetting,
    setTokenInfo,
    setNetwork,
    setSwapType,
    setRouter,

    // Batch operations
    resetAnalytics,

    // Log submission
    logSwapAction,
  };
}
