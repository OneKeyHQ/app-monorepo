import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';

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
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

interface IUseOrderConfirmOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export interface IUseOrderConfirmReturn {
  isSubmitting: boolean;
  handleConfirm: (overrideSide?: 'long' | 'short') => Promise<void>;
}

export function useOrderConfirm(
  options?: IUseOrderConfirmOptions,
): IUseOrderConfirmReturn {
  const [formData] = useTradingFormAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const hyperliquidActions = useHyperliquidActions();
  const [isSubmitting] = useTradingLoadingAtom();

  const handleConfirm = useCallback(
    async (overrideSide?: 'long' | 'short') => {
      if (activeAsset?.assetId === undefined) {
        Toast.error({
          title: 'Order Failed',
          message: 'Token information not available',
        });
        return;
      }

      let effectiveFormData = overrideSide
        ? { ...formData, side: overrideSide }
        : formData;

      if (formData.hasTpsl && (formData.tpValue || formData.slValue)) {
        const entryPrice =
          effectiveFormData.type === 'market'
            ? new BigNumber(activeAssetCtx?.ctx?.markPrice || '0')
            : new BigNumber(effectiveFormData.price || '0');

        let calculatedTpTriggerPx = '';
        let calculatedSlTriggerPx = '';

        if (formData.tpValue) {
          if (formData.tpType === 'price') {
            calculatedTpTriggerPx = formData.tpValue;
          } else {
            const percent = new BigNumber(formData.tpValue);
            if (percent.isFinite() && entryPrice.gt(0)) {
              calculatedTpTriggerPx = entryPrice
                .multipliedBy(percent)
                .dividedBy(100)
                .plus(entryPrice)
                .toFixed();
              calculatedTpTriggerPx = formatPriceToSignificantDigits(
                calculatedTpTriggerPx,
              );
            }
          }
        }

        if (formData.slValue) {
          if (formData.slType === 'price') {
            calculatedSlTriggerPx = formData.slValue;
          } else {
            const percent = new BigNumber(formData.slValue);
            if (percent.isFinite() && entryPrice.gt(0)) {
              calculatedSlTriggerPx = entryPrice
                .multipliedBy(percent)
                .dividedBy(100)
                .plus(entryPrice)
                .toFixed();
              calculatedSlTriggerPx = formatPriceToSignificantDigits(
                calculatedSlTriggerPx,
              );
            }
          }
        }

        effectiveFormData = {
          ...effectiveFormData,
          tpTriggerPx: calculatedTpTriggerPx,
          slTriggerPx: calculatedSlTriggerPx,
        };
      }

      try {
        if (effectiveFormData.type === 'market') {
          await hyperliquidActions.current.orderOpen({
            assetId: activeAsset.assetId,
            formData: effectiveFormData,
            price: activeAssetCtx?.ctx?.markPrice || '0',
          });
        } else {
          await hyperliquidActions.current.orderOpen({
            assetId: activeAsset.assetId,
            formData: effectiveFormData,
            price: effectiveFormData.price || '0',
          });
        }

        // Reset form after successful order
        hyperliquidActions.current.resetTradingForm();

        options?.onSuccess?.();
      } catch (error) {
        options?.onError?.(error);
      }
    },
    [
      activeAssetCtx?.ctx?.markPrice,
      activeAsset.assetId,
      formData,
      hyperliquidActions,
      options,
    ],
  );

  return {
    isSubmitting,
    handleConfirm,
  };
}
