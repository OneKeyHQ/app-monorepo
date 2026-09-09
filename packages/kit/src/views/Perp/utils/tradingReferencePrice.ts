import BigNumber from 'bignumber.js';

import type { IBBOPriceMode } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

/**
 * Reference price for size conversion on standard (non-trigger, non-scale)
 * orders. With BBO active the static price input is hidden and possibly
 * stale/empty, so sizing must follow the live BBO-resolved order price —
 * which tracks book updates — instead of `formData.price`.
 */
export function resolveStandardReferencePriceBN({
  type,
  bboPriceMode,
  orderPriceBN,
  formPrice,
  midPriceBN,
}: {
  type: 'market' | 'limit';
  bboPriceMode: IBBOPriceMode | null | undefined;
  orderPriceBN: BigNumber;
  formPrice: string;
  midPriceBN: BigNumber;
}): BigNumber {
  if (type === 'limit' && bboPriceMode) {
    return orderPriceBN;
  }
  if (type === 'limit' && formPrice) {
    return new BigNumber(formPrice);
  }
  if (type === 'market') {
    return midPriceBN;
  }
  return new BigNumber(0);
}
