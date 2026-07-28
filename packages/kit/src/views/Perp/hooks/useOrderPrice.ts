import { useEffect, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import type { IBBOPriceMode } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useActiveTradeInstrumentAtom,
  useBboForOrderPrice,
  useTradingFormOrderPriceParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { getPerpsMarketDataLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import type { IPerpsActiveAssetCtxMidPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getScaleOrderReferencePrice } from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import {
  getTriggerEffectivePrice,
  resolveBboOrderPrice,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  getPerpsBboInteractiveRefreshDelayMs,
  isPerpsBboInteractive,
} from '../utils/l2BookFreshness';

import { useTradingPrice } from './useTradingPrice';

export type IOrderPriceError = 'bbo_unavailable' | null;

export interface IUseOrderPriceReturn {
  price: BigNumber;
  isValid: boolean;
  error: IOrderPriceError;
}

interface IUseOrderPriceOptions {
  priceSource?: IPerpsActiveAssetCtxMidPriceSource;
}

/**
 * Calculate order price for different scenarios:
 * - Trigger order: uses trigger effective price (triggerPrice for market, executionPrice for limit)
 * - Market order: uses midPrice
 * - Limit with BBO: selects price from BBO based on side and mode (counterparty/queue)
 * - Limit without BBO: uses user input price
 */
export function calculateOrderPrice(
  formType: 'market' | 'limit',
  formPrice: string,
  bboPriceMode: IBBOPriceMode | undefined,
  bbo: HL.IWsBbo | null,
  midPriceBN: BigNumber,
  side?: 'long' | 'short',
  orderMode?: 'standard' | 'trigger' | 'scale' | 'twap',
  triggerOrderType?: ETriggerOrderType,
  triggerPrice?: string,
  executionPrice?: string,
  scaleLowerPrice?: string,
  scaleUpperPrice?: string,
  szDecimals?: number,
  now = Date.now(),
): IUseOrderPriceReturn {
  // Trigger mode: use trigger effective price
  if (orderMode === 'trigger' && triggerOrderType) {
    const effectivePrice = getTriggerEffectivePrice({
      triggerOrderType,
      triggerPrice,
      executionPrice,
      midPrice:
        midPriceBN.isFinite() && midPriceBN.gt(0)
          ? midPriceBN.toFixed()
          : undefined,
    });
    const isValid = effectivePrice.isFinite() && effectivePrice.gt(0);
    return {
      price: effectivePrice,
      isValid,
      error: null,
    };
  }

  if (orderMode === 'scale') {
    const scalePrice = getScaleOrderReferencePrice({
      lowerPrice: scaleLowerPrice,
      upperPrice: scaleUpperPrice,
    });
    const isValid = scalePrice.isFinite() && scalePrice.gt(0);
    return {
      price: scalePrice,
      isValid,
      error: null,
    };
  }

  // Market order: always use midPrice
  if (formType === 'market') {
    const isValid = midPriceBN.isFinite() && midPriceBN.gt(0);
    return {
      price: midPriceBN,
      isValid,
      error: null,
    };
  }

  // Limit order with BBO mode
  if (formType === 'limit' && bboPriceMode && side) {
    // BBO mode is enabled, but BBO data is not available - this is an error state
    if (
      !bbo?.bbo ||
      !bbo.bbo[0] ||
      !bbo.bbo[1] ||
      !isPerpsBboInteractive({
        bboTime: bbo.time,
        bboReceivedAt: getPerpsMarketDataLocalReceivedAt(bbo),
        now,
      })
    ) {
      return {
        price: new BigNumber(0),
        isValid: false,
        error: 'bbo_unavailable',
      };
    }

    const [bid, ask] = bbo.bbo;
    if (szDecimals === undefined) {
      return {
        price: new BigNumber(0),
        isValid: false,
        error: 'bbo_unavailable',
      };
    }

    const priceBN = resolveBboOrderPrice({
      bid: bid.px,
      ask: ask.px,
      side,
      type: bboPriceMode.type,
      offsetTicks: bboPriceMode.offsetTicks,
      szDecimals,
    });

    if (!priceBN) {
      return {
        price: new BigNumber(0),
        isValid: false,
        error: 'bbo_unavailable',
      };
    }

    return {
      price: priceBN,
      isValid: true,
      error: null,
    };
  }

  // Limit order without BBO mode: use user input price
  if (formType === 'limit') {
    const priceBN = new BigNumber(formPrice || 0);
    const isValid = priceBN.isFinite() && priceBN.gt(0);
    return {
      price: priceBN,
      isValid,
      error: null,
    };
  }

  // Fallback
  return {
    price: new BigNumber(0),
    isValid: false,
    error: null,
  };
}

function useOrderPriceWithMidPrice(
  midPriceBN: BigNumber,
  side?: 'long' | 'short',
  isPerp = true,
  szDecimals?: number,
): IUseOrderPriceReturn {
  const formData = useTradingFormOrderPriceParams();
  const bboPriceMode = isPerp ? formData.bboPriceMode : undefined;
  const shouldTrackBboFreshness =
    formData.type === 'limit' && Boolean(bboPriceMode) && Boolean(side);
  const bbo = useBboForOrderPrice(shouldTrackBboFreshness);
  const [, refreshBboFreshness] = useState(0);
  const bboReceivedAt = getPerpsMarketDataLocalReceivedAt(bbo);

  useEffect(() => {
    if (!shouldTrackBboFreshness) {
      return undefined;
    }

    const refreshDelayMs = getPerpsBboInteractiveRefreshDelayMs({
      bboTime: bbo?.time,
      bboReceivedAt,
    });
    if (refreshDelayMs === undefined) {
      return undefined;
    }

    const timer = setTimeout(() => {
      refreshBboFreshness((value) => value + 1);
    }, refreshDelayMs);

    return () => clearTimeout(timer);
  }, [bbo?.time, bboReceivedAt, shouldTrackBboFreshness]);

  return calculateOrderPrice(
    formData.type,
    formData.price,
    bboPriceMode,
    bbo,
    midPriceBN,
    side,
    formData.orderMode,
    formData.triggerOrderType,
    formData.triggerPrice,
    formData.executionPrice,
    formData.scaleLowerPrice,
    formData.scaleUpperPrice,
    szDecimals,
  );
}

export function useOrderPrice(
  side?: 'long' | 'short',
  { priceSource = 'live' }: IUseOrderPriceOptions = {},
): IUseOrderPriceReturn {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { midPriceBN } = useTradingPrice({ source: priceSource });
  return useOrderPriceWithMidPrice(
    midPriceBN,
    side,
    activeTradeInstrument.mode === 'perp',
    activeTradeInstrument.mode === 'perp'
      ? activeTradeInstrument.universe?.szDecimals
      : undefined,
  );
}
