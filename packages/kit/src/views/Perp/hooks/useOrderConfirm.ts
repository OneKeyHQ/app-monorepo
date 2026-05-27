import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatPriceToSignificantDigits,
  formatSpotPriceToValid,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  type IPerpsMarketDataFreshness,
  shouldBlockPerpsTradingForMarketData,
} from '../utils/perpsMarketDataFreshness';

import { useOrderPrice } from './useOrderPrice';
import { usePerpsMarketDataFreshness } from './usePerpsMarketDataFreshness';
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
  const marketDataFreshness = usePerpsMarketDataFreshness();
  return useOrderConfirmWithMarketDataFreshness({
    ...options,
    marketDataFreshness,
  });
}

export function useOrderConfirmWithMarketDataFreshness({
  marketDataFreshness,
  ...options
}: IUseOrderConfirmOptions & {
  marketDataFreshness: IPerpsMarketDataFreshness;
}): IUseOrderConfirmReturn {
  const intl = useIntl();
  const [formData] = useTradingFormAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const hyperliquidActions = useHyperliquidActions();
  const [isSubmitting] = useTradingLoadingAtom();
  const { midPrice, midPriceBN } = useTradingPrice();
  const shouldBlockForMarketData =
    shouldBlockPerpsTradingForMarketData(marketDataFreshness);

  const longOrderPrice = useOrderPrice('long');
  const shortOrderPrice = useOrderPrice('short');

  const handleConfirm = useCallback(
    async (overrideSide?: 'long' | 'short') => {
      if (shouldBlockForMarketData) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.perp_offline,
          }),
          message: intl.formatMessage({
            id: ETranslations.perps_offline_moblie,
          }),
        });
        return;
      }

      if (activeTradeInstrument?.assetId === undefined) {
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

      if (
        activeTradeInstrument.mode === 'spot' &&
        formDataSnapshot.orderMode === 'trigger'
      ) {
        Toast.error({
          title: 'Order Failed',
          message: 'Trigger orders are not supported in spot mode',
        });
        return;
      }

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
            assetId: activeTradeInstrument.assetId,
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
      } else if (activeTradeInstrument.mode === 'spot') {
        const szDec = activeTradeInstrument.universe?.baseSzDecimals ?? 0;
        effectivePrice = formatSpotPriceToValid(
          orderPrice.price.toFixed(),
          szDec,
        );
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
          assetId: activeTradeInstrument.assetId,
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
      activeTradeInstrument,
      formData,
      hyperliquidActions,
      options,
      longOrderPrice,
      shortOrderPrice,
      intl,
      shouldBlockForMarketData,
    ],
  );

  return {
    isSubmitting,
    handleConfirm,
  };
}
