import { useCallback } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSwapAnalyticsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EAmountEnterType,
  ERouter,
  ESlippageSetting,
  ESwapType,
} from '@onekeyhq/shared/src/logger/scopes/dex/types';
import type { IDexSwapParams } from '@onekeyhq/shared/src/logger/scopes/dex/types';

import { ESwapDirection, type ITradeType } from './useTradeType';

import type { IToken } from '../types';
import type { IAmountEnterSource } from '../types/analytics';

export function useSwapAnalytics() {
  const [analyticsState, setAnalyticsState] = useSwapAnalyticsAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });

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
      setAnalyticsState((prev) => ({ ...prev, amountEnterType }));
    },
    [setAnalyticsState],
  );

  // Set slippage setting
  const setSlippageSetting = useCallback(
    (isManual: boolean) => {
      const slippageSetting = isManual
        ? ESlippageSetting.Manual
        : ESlippageSetting.Auto;
      setAnalyticsState((prev) => ({
        ...prev,
        slippageSetting,
      }));
    },
    [setAnalyticsState],
  );

  // Reset analytics
  const resetAnalytics = useCallback(() => {
    setAnalyticsState({
      amountEnterType: EAmountEnterType.Manual,
      slippageSetting: ESlippageSetting.Auto,
    });
  }, [setAnalyticsState]);

  // Submit log with error handling
  const logSwapAction = useCallback(
    (params: {
      tradeType: ITradeType;
      networkId?: string;
      paymentToken?: IToken;
      balanceToken?: IToken;
    }) => {
      try {
        // Update environment with provided params
        const { tradeType, networkId, paymentToken, balanceToken } = params;

        // Only proceed if we have necessary data
        if (!networkId || !paymentToken || !balanceToken) {
          return;
        }

        const marketToken = {
          symbol: balanceToken.symbol || '',
        };

        const sourceTokenSymbol =
          tradeType === ESwapDirection.BUY
            ? paymentToken.symbol ?? ''
            : marketToken.symbol;
        const receivedTokenSymbol =
          tradeType === ESwapDirection.BUY
            ? marketToken.symbol
            : paymentToken.symbol ?? '';

        const walletType = activeAccount?.wallet?.type;
        if (walletType) {
          // Directly create and use analytics data without updating atom state
          const dexSwapParams: IDexSwapParams = {
            walletType,
            sourceTokenSymbol,
            receivedTokenSymbol,
            network: networkId,
            swapType:
              tradeType === ESwapDirection.BUY ? ESwapType.Buy : ESwapType.Sell,
            router: ERouter.OKX,
            // Use current analytics state for user input settings
            amountEnterType: analyticsState.amountEnterType,
            slippageSetting: analyticsState.slippageSetting,
          };
          defaultLogger.dex.swap.dexSwap(dexSwapParams);
        }
      } catch (error) {
        // Silently handle analytics errors to not affect main functionality
        console.warn('Analytics logging failed:', error);
      }
    },
    [activeAccount?.wallet?.type, analyticsState],
  );

  return {
    // State
    analyticsState,

    // Setter methods
    setAmountEnterType,
    setSlippageSetting,

    // Batch operations
    resetAnalytics,

    // Log submission
    logSwapAction,
  };
}
