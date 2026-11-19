import type { IBorrowTransactionConfirmation } from '@onekeyhq/shared/types/staking';

import { hidesPositionNotHeld } from '../../reserveFormScope';

import type { IBorrowReserveFormScope } from '../../reserveFormScope';

// The rows a loan's side lists on a reserve's own page (demo 11-03), in the
// order the outlined card has them: the position's, then the rest
export type IReserveBorrowRowKind =
  | 'health-factor'
  | 'my-supply'
  | 'my-borrow'
  | 'apy'
  | 'refundable-fee'
  | 'refund-fee'
  | 'collateral'
  | 'swap';

export function getReserveBorrowRowKinds({
  action,
  confirmation,
  position,
  isForTypedAmount,
  showApyDetail,
  offersSwap,
}: {
  action: 'borrow' | 'repay';
  confirmation?: IBorrowTransactionConfirmation;
  // What the page has read of the account's position in the reserve
  position?: IBorrowReserveFormScope['position'];
  // The rows are for an amount typed, not for the empty box
  isForTypedAmount: boolean;
  showApyDetail: boolean;
  // "Not enough X?" with its Swap, where the form has a token for it
  offersSwap: boolean;
}): IReserveBorrowRowKind[] {
  const kinds: IReserveBorrowRowKind[] = [];
  const offersSwapRow = action === 'repay' && offersSwap;
  const hidesMySupply = hidesPositionNotHeld({
    holds: position?.hasSupply,
    hasAmount: isForTypedAmount,
  });
  const hidesMyBorrow = hidesPositionNotHeld({
    holds: position?.hasBorrow,
    hasAmount: isForTypedAmount,
  });
  // Before the market's first answer the rows it always has hold their
  // places, each with a dash
  if (!confirmation) {
    if (!hidesMyBorrow) {
      kinds.push('my-borrow');
    }
    if (action === 'borrow' && showApyDetail) {
      kinds.push('apy');
    }
    if (offersSwapRow) {
      kinds.push('swap');
    }
    return kinds;
  }
  if (confirmation.healthFactor) {
    kinds.push('health-factor');
  }
  if (confirmation.mySupply && !hidesMySupply) {
    kinds.push('my-supply');
  }
  if (confirmation.myBorrow && !hidesMyBorrow) {
    kinds.push('my-borrow');
  }
  if (showApyDetail && confirmation.apyDetail) {
    kinds.push('apy');
  }
  if (confirmation.refundableFee) {
    kinds.push('refundable-fee');
  }
  if (confirmation.refundFee) {
    kinds.push('refund-fee');
  }
  const { canBeCollateral, usageAsCollateral } = confirmation;
  // Older responses omit usageAsCollateral; the switch state isn't guessed
  if (
    canBeCollateral === false ||
    (canBeCollateral === true && usageAsCollateral !== undefined)
  ) {
    kinds.push('collateral');
  }
  if (offersSwapRow) {
    kinds.push('swap');
  }
  return kinds;
}
