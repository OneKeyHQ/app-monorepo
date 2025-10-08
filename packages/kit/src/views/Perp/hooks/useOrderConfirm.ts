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

      // Reset form before placing order
      hyperliquidActions.current.resetTradingForm();

      let effectiveFormData = overrideSide
        ? { ...formData, side: overrideSide }
        : formData;

      const { tpValue, slValue, tpType, slType, leverage = 1 } = formData;
      const leverageBN = new BigNumber(leverage);
      if (formData.hasTpsl && (tpValue || slValue)) {
        const entryPrice =
          effectiveFormData.type === 'market'
            ? new BigNumber(activeAssetCtx?.ctx?.markPrice || '0')
            : new BigNumber(effectiveFormData.price || '0');

        let calculatedTpTriggerPx: BigNumber | null = null;
        let calculatedSlTriggerPx: BigNumber | null = null;
        const side = effectiveFormData.side;

        if (tpValue) {
          const _tpValue = new BigNumber(tpValue);
          if (tpType === 'price') {
            calculatedTpTriggerPx = _tpValue;
          }
          if (tpType === 'percentage' && entryPrice.gt(0)) {
            const percentChange = entryPrice
              .multipliedBy(_tpValue)
              .dividedBy(100)
              .dividedBy(leverageBN);
            const tpPrice =
              side === 'long'
                ? entryPrice.plus(percentChange)
                : entryPrice.minus(percentChange);
            calculatedTpTriggerPx = tpPrice;
          }
        }

        if (slValue) {
          const _slValue = new BigNumber(slValue);
          if (slType === 'price') {
            calculatedSlTriggerPx = _slValue;
          }
          if (slType === 'percentage' && entryPrice.gt(0)) {
            const percentChange = entryPrice
              .multipliedBy(_slValue)
              .dividedBy(100)
              .dividedBy(leverageBN);
            const slPrice =
              side === 'long'
                ? entryPrice.minus(percentChange)
                : entryPrice.plus(percentChange);
            calculatedSlTriggerPx = slPrice;
          }
        }

        effectiveFormData = {
          ...effectiveFormData,
          tpTriggerPx: calculatedTpTriggerPx
            ? formatPriceToSignificantDigits(calculatedTpTriggerPx)
            : '',
          slTriggerPx: calculatedSlTriggerPx
            ? formatPriceToSignificantDigits(calculatedSlTriggerPx)
            : '',
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
