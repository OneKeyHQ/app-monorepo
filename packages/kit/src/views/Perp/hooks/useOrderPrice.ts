import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import type { IBBOPriceMode } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useBboAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useTradingPrice } from './useTradingPrice';

export type IOrderPriceError = 'bbo_unavailable' | null;

export interface IUseOrderPriceReturn {
  price: BigNumber;
  isValid: boolean;
  error: IOrderPriceError;
}

/**
 * Calculate order price for different scenarios:
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
): IUseOrderPriceReturn {
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
      ),
    [
      formData.type,
      formData.price,
      formData.bboPriceMode,
      bbo,
      midPriceBN,
      side,
    ],
  );
}
