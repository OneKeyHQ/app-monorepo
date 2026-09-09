import BigNumber from 'bignumber.js';

import type { IBorrowEModeSwitchCheck } from '@onekeyhq/shared/types/staking';

import { buildNeedActionItems } from '../BorrowEModeSwitch/emodeUtils';

export function isEModeBlockerDataUnavailable(
  check: IBorrowEModeSwitchCheck | null | undefined,
): boolean {
  if (!check || check.canSwitch) {
    return false;
  }
  return !buildNeedActionItems(check).some((item) => {
    if (item.kind === 'removeCollateral') {
      return true;
    }
    const amount = new BigNumber(item.amountValue ?? '');
    return amount.isFinite() && amount.gt(0);
  });
}
