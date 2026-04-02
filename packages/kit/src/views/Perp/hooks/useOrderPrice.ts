import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import type { IBBOPriceMode } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useBboAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { getTriggerEffectivePrice } from '@onekeyhq/shared/src/utils/perpsUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useTradingPrice } from './useTradingPrice';

export type IOrderPriceError = 'bbo_unavailable' | null;

export interface IUseOrderPriceReturn {
  price: BigNumber;
  isValid: boolean;
  error: IOrderPriceError;
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
  orderMode?: 'standard' | 'trigger',
  triggerOrderType?: ETriggerOrderType,
  triggerPrice?: string,
  executionPrice?: string,
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
    if (!bbo?.bbo || !bbo.bbo[0] || !bbo.bbo[1]) {
      return {
        price: new BigNumber(0),
        isValid: false,
        error: 'bbo_unavailable',
      };
    }

    const [bid, ask] = bbo.bbo;
    const { type } = bboPriceMode;

    let targetPrice: string | null = null;

    if (side === 'long') {
      // Long: Counterparty = Ask (taker, immediate fill), Queue = Bid (maker, wait in queue)
      targetPrice = type === 'counterparty' ? ask?.px : bid?.px;
    } else {
      // Short: Counterparty = Bid (taker, immediate fill), Queue = Ask (maker, wait in queue)
      targetPrice = type === 'counterparty' ? bid?.px : ask?.px;
    }

    if (!targetPrice) {
      return {
        price: new BigNumber(0),
        isValid: false,
        error: 'bbo_unavailable',
      };
    }

    const priceBN = new BigNumber(targetPrice);
    const isValid = priceBN.isFinite() && priceBN.gt(0);

    return {
      price: priceBN,
      isValid,
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

export function useOrderPrice(side?: 'long' | 'short'): IUseOrderPriceReturn {
  const [formData] = useTradingFormAtom();
  const [bbo] = useBboAtom();
  const { midPriceBN } = useTradingPrice();

  return useMemo<IUseOrderPriceReturn>(
    () =>
      calculateOrderPrice(
        formData.type,
        formData.price,
        formData.bboPriceMode,
        bbo,
        midPriceBN,
        side,
        formData.orderMode,
        formData.triggerOrderType,
        formData.triggerPrice,
        formData.executionPrice,
      ),
    [
      formData.type,
      formData.price,
      formData.bboPriceMode,
      formData.orderMode,
      formData.triggerOrderType,
      formData.triggerPrice,
      formData.executionPrice,
      bbo,
      midPriceBN,
      side,
    ],
  );
}
