import BigNumber from 'bignumber.js';

import {
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';

export const ESwapSlippageValidationStatus = {
  NORMAL: 'normal',
  ERROR: 'error',
  WILL_FAIL: 'willFail',
  WILL_AHEAD: 'willAhead',
} as const;

export function getSwapSlippageValidationStatus(
  value: BigNumber.Value | undefined,
) {
  const valueBN = new BigNumber(value ?? Number.NaN);
  if (
    valueBN.isNaN() ||
    valueBN.isNegative() ||
    valueBN.gt(swapSlippageMaxValue)
  ) {
    return ESwapSlippageValidationStatus.ERROR;
  }
  if (valueBN.lt(swapSlippageWillFailMinValue)) {
    return ESwapSlippageValidationStatus.WILL_FAIL;
  }
  if (valueBN.gt(swapSlippageWillAheadMinValue)) {
    return ESwapSlippageValidationStatus.WILL_AHEAD;
  }
  return ESwapSlippageValidationStatus.NORMAL;
}
