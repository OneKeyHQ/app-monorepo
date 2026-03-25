import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';

import { Toast } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useOrderPrice } from './useOrderPrice';
import { useTradingPrice } from './useTradingPrice';

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
  const [activeAsset] = usePerpsActiveAssetAtom();
  const hyperliquidActions = useHyperliquidActions();
  const [isSubmitting] = useTradingLoadingAtom();
  const { midPrice, midPriceBN } = useTradingPrice();

  const longOrderPrice = useOrderPrice('long');
  const shortOrderPrice = useOrderPrice('short');

  const handleConfirm = useCallback(
    async (overrideSide?: 'long' | 'short') => {
      if (activeAsset?.assetId === undefined) {
        Toast.error({
          title: 'Order Failed',
          message: 'Token information not available',
        });
        return;
      }

      const formDataSnapshot = overrideSide
        ? { ...formData, side: overrideSide }
        : { ...formData };

      const side = formDataSnapshot.side;

      // Trigger mode: validate, snapshot, and submit (no TP/SL, no standard price validation)
      if (formDataSnapshot.orderMode === 'trigger') {
        const triggerOrderType =
          formDataSnapshot.triggerOrderType ?? ETriggerOrderType.TRIGGER_MARKET;
        const tp = formDataSnapshot.triggerPrice?.trim();
        if (!tp || new BigNumber(tp).lte(0)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Trigger price is required',
          });
          return;
        }
        const isLimitTrigger =
          triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;
        if (isLimitTrigger) {
          const ep = formDataSnapshot.executionPrice?.trim();
          if (!ep || new BigNumber(ep).lte(0)) {
            Toast.error({
              title: 'Order Failed',
              message: 'Execution price is required',
            });
            return;
          }
        }
        if (!midPriceBN.isFinite() || midPriceBN.lte(0)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Market price unavailable, please try again',
          });
          return;
        }
        if (new BigNumber(tp).eq(midPriceBN)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Trigger price must differ from current price',
          });
          return;
        }
        hyperliquidActions.current.resetTradingForm();
        try {
          await hyperliquidActions.current.submitOrder({
            assetId: activeAsset.assetId,
            formData: formDataSnapshot,
            price: '0', // not used for trigger orders
          });
          options?.onSuccess?.();
        } catch (error) {
          options?.onError?.(error);
        }
        return;
      }

      const orderPrice = side === 'long' ? longOrderPrice : shortOrderPrice;

      if (orderPrice.error) {
        Toast.error({
          title: 'Order Failed',
          message: 'Price data is not available. Please try again.',
        });
        return;
      }

      // Use the price from useOrderPrice
      let effectivePrice: string;
      if (formDataSnapshot.type === 'market') {
        if (!midPrice) {
          Toast.error({
            title: 'Order Failed',
            message: 'Market price is not available. Please try again.',
          });
          return;
        }
        effectivePrice = midPrice;
      } else {
        effectivePrice = formatPriceToSignificantDigits(orderPrice.price);
      }

      hyperliquidActions.current.resetTradingForm();

      let effectiveFormData = {
        ...formDataSnapshot,
        price: effectivePrice,
      };

      const {
        tpValue,
        slValue,
        tpType,
        slType,
        leverage = 1,
      } = formDataSnapshot;
      const leverageBN = new BigNumber(leverage);
      if (formDataSnapshot.hasTpsl && (tpValue || slValue)) {
        const entryPrice =
          effectiveFormData.type === 'market'
            ? midPriceBN
            : new BigNumber(effectiveFormData.price || '0');

        let calculatedTpTriggerPx: BigNumber | null = null;
        let calculatedSlTriggerPx: BigNumber | null = null;

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
        await hyperliquidActions.current.submitOrder({
          assetId: activeAsset.assetId,
          formData: effectiveFormData,
          price:
            effectiveFormData.type === 'market'
              ? midPrice || '0'
              : effectivePrice || '0',
        });

        options?.onSuccess?.();
      } catch (error) {
        options?.onError?.(error);
      }
    },
    [
      midPrice,
      midPriceBN,
      activeAsset.assetId,
      formData,
      hyperliquidActions,
      options,
      longOrderPrice,
      shortOrderPrice,
    ],
  );

  return {
    isSubmitting,
    handleConfirm,
  };
}
