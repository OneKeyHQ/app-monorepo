import { useCallback, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useCurrentTokenData } from './usePerpMarketData';

interface IUseOrderConfirmOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export interface IUseOrderConfirmReturn {
  isSubmitting: boolean;
  handleConfirm: () => Promise<void>;
}

export function useOrderConfirm(
  options?: IUseOrderConfirmOptions,
): IUseOrderConfirmReturn {
  const [formData] = useTradingFormAtom();
  const tokenInfo = useCurrentTokenData();
  const hyperliquidActions = useHyperliquidActions();
  const [isSubmitting] = useTradingLoadingAtom();

  const handleConfirm = useCallback(async () => {
    if (tokenInfo?.assetId === undefined) {
      Toast.error({
        title: 'Order Failed',
        message: 'Token information not available',
      });
      return;
    }

    try {
      if (formData.type === 'market') {
        await hyperliquidActions.current.orderOpen({
          assetId: tokenInfo.assetId,
          formData,
          price: tokenInfo.markPx || '0',
        });
      } else {
        await hyperliquidActions.current.orderOpen({
          assetId: tokenInfo.assetId,
          formData,
          price: formData.price || '0',
        });
      }

      // Reset form after successful order
      hyperliquidActions.current.resetTradingForm();

      options?.onSuccess?.();
    } catch (error) {
      options?.onError?.(error);
    }
  }, [tokenInfo, formData, hyperliquidActions, options]);

  return {
    isSubmitting,
    handleConfirm,
  };
}
