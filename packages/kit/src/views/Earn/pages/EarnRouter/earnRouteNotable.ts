import BigNumber from 'bignumber.js';

import { getSwapQuoteDurationMinutes } from '@onekeyhq/shared/src/utils/swapQuoteDurationUtils';

// In the router windows a bridge's time and fee are said before the press
// only where they weigh: minutes of waiting, or a fee that is a visible part
// of what is paid. Under that, the amount that arrives says enough
const NOTABLE_BRIDGE_MINUTES = 3;
const NOTABLE_FEE_SHARE = 0.005;

export function isNotableBridgeTime(
  quote?: Parameters<typeof getSwapQuoteDurationMinutes>[0],
) {
  const minutes = quote ? getSwapQuoteDurationMinutes(quote) : undefined;
  return Boolean(minutes?.gte(NOTABLE_BRIDGE_MINUTES));
}

export function isNotableBridgeFee(
  fee: number | string | undefined,
  paidFiat: number | string | undefined,
) {
  if (fee === undefined) {
    return false;
  }
  const feeValue = new BigNumber(fee);
  const paid = new BigNumber(paidFiat ?? 0);
  return (
    feeValue.isFinite() &&
    paid.isFinite() &&
    paid.gt(0) &&
    feeValue.gte(paid.times(NOTABLE_FEE_SHARE))
  );
}
