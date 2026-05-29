import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

// Resolve a token detail's parsed balance, mirroring SendAmountInputContainer's
// fallback: some `fetchTokensDetails` responses fill `balance` but leave
// `balanceParsed` nil. Treating that as "0" would make `pickBestSibling()` drop
// a sibling that actually has funds and misreport "no usable address format",
// so we back-fill from the raw `balance` + decimals the same way the current
// account's path does.
export function resolveSiblingBalanceParsed(
  detail: IFetchTokenDetailItem,
): string {
  if (!isNil(detail.balanceParsed)) {
    return detail.balanceParsed;
  }
  return new BigNumber(detail.balance)
    .shiftedBy(detail.info.decimals * -1)
    .toFixed();
}
