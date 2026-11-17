import BigNumber from 'bignumber.js';

import { countSignificantRateDecimals } from '@onekeyhq/shared/src/utils/numberUtils';

// Prices above one use six decimals. Sub-one prices extend past leading zeros
// so small token prices keep their significant digits instead of becoming zero.
export function formatSwapProLimitPriceForDisplay(priceBN: BigNumber): string {
  return priceBN
    .decimalPlaces(
      countSignificantRateDecimals(priceBN, 0),
      BigNumber.ROUND_HALF_UP,
    )
    .toFixed();
}
