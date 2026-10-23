import BigNumber from 'bignumber.js';

import { swapProPositionsListMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

export function isTradePositionVisible({
  balance,
  fiatValue,
  isStock = false,
}: {
  balance?: string;
  fiatValue?: string;
  isStock?: boolean;
}) {
  // Stock holdings stay visible at any positive balance, even without a price.
  return isStock
    ? new BigNumber(balance ?? '0').gt(0)
    : new BigNumber(fiatValue || '0').gt(swapProPositionsListMinValue);
}
