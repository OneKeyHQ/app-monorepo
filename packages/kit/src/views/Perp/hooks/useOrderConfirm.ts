import { useCallback, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const hyperliquidActions = useHyperliquidActions();
  const [isSubmitting] = useTradingLoadingAtom();

  const handleConfirm = useCallback(async () => {
    if (activeAsset?.assetId === undefined) {
      Toast.error({
        title: 'Order Failed',
        message: 'Token information not available',
      });
      return;
    }

    try {
      if (formData.type === 'market') {
        await hyperliquidActions.current.orderOpen({
          assetId: activeAsset.assetId,
          formData,
          price: activeAssetCtx?.ctx?.markPrice || '0',
        });
      } else {
        await hyperliquidActions.current.orderOpen({
          assetId: activeAsset.assetId,
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
  }, [
    activeAssetCtx?.ctx?.markPrice,
    activeAsset.assetId,
    formData,
    hyperliquidActions,
    options,
  ]);

  return {
    isSubmitting,
    handleConfirm,
  };
}
