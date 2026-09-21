import BigNumber from 'bignumber.js';

import { ZCASH_DECIMALS } from './constants';

export function zatoshiToZec(value: BigNumber.Value): string {
  return new BigNumber(value).shiftedBy(-ZCASH_DECIMALS).toFixed();
}
