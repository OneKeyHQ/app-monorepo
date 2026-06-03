import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  usePerpsActivePositionAtom,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  SCALE_ORDER_MAX_COUNT,
  SCALE_ORDER_MIN_COUNT,
  SCALE_ORDER_MIN_NOTIONAL,
  buildScaleOrderLegs,
  getReduceOnlyOrderGuardError,
  getReduceOnlyPositionSnapshotError,
  getScaleOrderReferencePrice,
  getScaleOrderSizeSkew,
  normalizeScaleOrderCount,
  validateScaleOrderLegs,
} from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import {
  formatPriceToSignificantDigits,
  formatSpotPriceToValid,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  type IPerpsMarketDataFreshness,
  shouldBlockPerpsTradingForMarketData,
} from '../utils/perpsMarketDataFreshness';
import { getScaleOrderValidationErrorMessage } from '../utils/scaleOrderValidation';

import { useOrderPrice } from './useOrderPrice';
import { usePerpsMarketDataFreshness } from './usePerpsMarketDataFreshness';
import { useTradingCalculationsForSide } from './useTradingCalculationsForSide';
import { useTradingPrice } from './useTradingPrice';

const TWAP_MIN_DURATION_MINUTES = 5;
const TWAP_MAX_DURATION_MINUTES = 1440;
const TWAP_ESTIMATED_SLICE_INTERVAL_SECONDS = 30;
const TWAP_MIN_ORDER_NOTIONAL = Number(SCALE_ORDER_MIN_NOTIONAL);

interface IUseOrderConfirmOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export interface IUseOrderConfirmReturn {
  isSubmitting: boolean;
  handleConfirm: (overrideSide?: 'long' | 'short') => Promise<void>;
}

function useOrderConfirmWithMarketDataFreshness({
  marketDataFreshness,
  ...options
}: IUseOrderConfirmOptions & {
  marketDataFreshness: IPerpsMarketDataFreshness;
}): IUseOrderConfirmReturn {
  const intl = useIntl();
  const [formData] = useTradingFormAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [activePositionsValue] = usePerpsActivePositionAtom();
  const hyperliquidActions = useHyperliquidActions();
  const [isSubmitting] = useTradingLoadingAtom();
  const { midPrice, midPriceBN } = useTradingPrice();
  const shouldBlockForMarketData =
    shouldBlockPerpsTradingForMarketData(marketDataFreshness);

  const longOrderPrice = useOrderPrice('long');
  const shortOrderPrice = useOrderPrice('short');
  const longCalculations = useTradingCalculationsForSide('long');
  const shortCalculations = useTradingCalculationsForSide('short');

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

      if (formDataSnapshot.orderMode === 'scale') {
        const referencePrice = getScaleOrderReferencePrice({
          lowerPrice: formDataSnapshot.scaleLowerPrice,
          upperPrice: formDataSnapshot.scaleUpperPrice,
        });
        if (!referencePrice.isFinite() || referencePrice.lte(0)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Scale price range is required',
          });
          return;
        }
        if (
          new BigNumber(formDataSnapshot.scaleLowerPrice ?? 0).eq(
            formDataSnapshot.scaleUpperPrice ?? 0,
          )
        ) {
          Toast.error({
            title: 'Order Failed',
            message: 'Scale lower and upper prices must be different',
          });
          return;
        }
        const orderCount = normalizeScaleOrderCount(
          formDataSnapshot.scaleOrderCount ?? 0,
        );
        if (
          orderCount < SCALE_ORDER_MIN_COUNT ||
          orderCount > SCALE_ORDER_MAX_COUNT
        ) {
          Toast.error({
            title: 'Order Failed',
            message: `Scale orders must be ${SCALE_ORDER_MIN_COUNT}-${SCALE_ORDER_MAX_COUNT} orders`,
          });
          return;
        }
        const scaleSize =
          side === 'long'
            ? longCalculations.computedSizeForSide
            : shortCalculations.computedSizeForSide;
        if (!scaleSize.isFinite() || scaleSize.lte(0)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Order size is required',
          });
          return;
        }
        const isSpotOrder = activeTradeInstrument.mode === 'spot';
        const szDecimals = isSpotOrder
          ? (activeTradeInstrument.universe?.baseSzDecimals ?? 2)
          : (activeTradeInstrument.universe?.szDecimals ?? 2);
        const scaleLegs = buildScaleOrderLegs({
          totalSize: scaleSize.toFixed(),
          lowerPrice: formDataSnapshot.scaleLowerPrice ?? '',
          upperPrice: formDataSnapshot.scaleUpperPrice ?? '',
          orderCount,
          szDecimals,
          side,
          sizeSkew: getScaleOrderSizeSkew(
            formDataSnapshot.scaleSizeDistribution,
          ),
          assetType: isSpotOrder ? 'spot' : 'perp',
        });
        const scaleValidation = validateScaleOrderLegs({ legs: scaleLegs });
        if (!scaleValidation.isValid) {
          Toast.error({
            title: 'Order Failed',
            message: getScaleOrderValidationErrorMessage({
              intl,
              validation: scaleValidation,
              fallback: 'Invalid scale order',
            }),
          });
          return;
        }
        if (!isSpotOrder && formDataSnapshot.scaleReduceOnly) {
          const snapshotError = getReduceOnlyPositionSnapshotError({
            reduceOnly: formDataSnapshot.scaleReduceOnly,
            accountAddress: currentUser?.accountAddress,
            positionsAccountAddress: activePositionsValue.accountAddress,
          });
          if (snapshotError) {
            Toast.error({
              title: 'Order Failed',
              message: snapshotError,
            });
            return;
          }
          const position = activePositionsValue.activePositions.find(
            (pos) => pos.position.coin === activeTradeInstrument.coin,
          )?.position;
          const reduceOnlyError = getReduceOnlyOrderGuardError({
            reduceOnly: formDataSnapshot.scaleReduceOnly,
            side,
            size: scaleSize,
            positionSize: position?.szi,
            missingPositionMessage:
              'Reduce-only scale requires an opposite open position',
            exceedsPositionMessage:
              'Reduce-only scale size exceeds the current position',
          });
          if (reduceOnlyError) {
            Toast.error({
              title: 'Order Failed',
              message: reduceOnlyError,
            });
            return;
          }
        }

        const effectiveFormData = {
          ...formDataSnapshot,
          type: 'limit' as const,
          price: referencePrice.toFixed(),
          bboPriceMode: null,
          hasTpsl: false,
          scaleReduceOnly: isSpotOrder
            ? false
            : formDataSnapshot.scaleReduceOnly,
        };

        hyperliquidActions.current.resetTradingForm();
        try {
          await hyperliquidActions.current.submitOrder({
            assetId: activeTradeInstrument.assetId,
            formData: effectiveFormData,
            price: referencePrice.toFixed(),
          });
          options?.onSuccess?.();
        } catch (error) {
          options?.onError?.(error);
        }
        return;
      }

      if (formDataSnapshot.orderMode === 'twap') {
        const duration = Number(formDataSnapshot.twapDurationMinutes ?? 0);
        if (
          !Number.isInteger(duration) ||
          duration < TWAP_MIN_DURATION_MINUTES ||
          duration > TWAP_MAX_DURATION_MINUTES
        ) {
          Toast.error({
            title: 'Order Failed',
            message: `TWAP duration must be ${TWAP_MIN_DURATION_MINUTES}-${TWAP_MAX_DURATION_MINUTES} minutes`,
          });
          return;
        }
        const isSpotOrder = activeTradeInstrument.mode === 'spot';
        const twapSize =
          side === 'long'
            ? longCalculations.computedSizeForSide
            : shortCalculations.computedSizeForSide;
        if (!twapSize.isFinite() || twapSize.lte(0)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Order size is required',
          });
          return;
        }
        if (!midPriceBN.isFinite() || midPriceBN.lte(0)) {
          Toast.error({
            title: 'Order Failed',
            message: 'Market price is not available. Please try again.',
          });
          return;
        }
        const estimatedSlices = Math.max(
          1,
          Math.ceil((duration * 60) / TWAP_ESTIMATED_SLICE_INTERVAL_SECONDS),
        );
        const averageSliceNotional = twapSize
          .multipliedBy(midPriceBN)
          .dividedBy(estimatedSlices);
        if (
          !averageSliceNotional.isFinite() ||
          averageSliceNotional.lt(TWAP_MIN_ORDER_NOTIONAL)
        ) {
          Toast.error({
            title: 'Order Failed',
            message: 'TWAP order size is too small for this duration',
          });
          return;
        }
        if (!isSpotOrder && formDataSnapshot.twapReduceOnly) {
          const snapshotError = getReduceOnlyPositionSnapshotError({
            reduceOnly: formDataSnapshot.twapReduceOnly,
            accountAddress: currentUser?.accountAddress,
            positionsAccountAddress: activePositionsValue.accountAddress,
          });
          if (snapshotError) {
            Toast.error({
              title: 'Order Failed',
              message: snapshotError,
            });
            return;
          }
          const position = activePositionsValue.activePositions.find(
            (pos) => pos.position.coin === activeTradeInstrument.coin,
          )?.position;
          const reduceOnlyError = getReduceOnlyOrderGuardError({
            reduceOnly: formDataSnapshot.twapReduceOnly,
            side,
            size: twapSize,
            positionSize: position?.szi,
            missingPositionMessage:
              'Reduce-only TWAP requires an opposite open position',
            exceedsPositionMessage:
              'Reduce-only TWAP size exceeds the current position',
          });
          if (reduceOnlyError) {
            Toast.error({
              title: 'Order Failed',
              message: reduceOnlyError,
            });
            return;
          }
        }

        const effectiveFormData = {
          ...formDataSnapshot,
          type: 'market' as const,
          price: '',
          bboPriceMode: null,
          hasTpsl: false,
          twapReduceOnly: isSpotOrder ? false : formDataSnapshot.twapReduceOnly,
        };

        hyperliquidActions.current.resetTradingForm();
        try {
          await hyperliquidActions.current.submitOrder({
            assetId: activeTradeInstrument.assetId,
            formData: effectiveFormData,
            price: midPrice || '0',
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
      activePositionsValue,
      currentUser?.accountAddress,
      formData,
      hyperliquidActions,
      options,
      longCalculations.computedSizeForSide,
      longOrderPrice,
      shortCalculations.computedSizeForSide,
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

export function useOrderConfirm(
  options?: IUseOrderConfirmOptions,
): IUseOrderConfirmReturn {
  const marketDataFreshness = usePerpsMarketDataFreshness();
  return useOrderConfirmWithMarketDataFreshness({
    ...options,
    marketDataFreshness,
  });
}

export { useOrderConfirmWithMarketDataFreshness };
