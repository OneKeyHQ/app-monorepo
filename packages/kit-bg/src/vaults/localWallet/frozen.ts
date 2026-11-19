import BigNumber from 'bignumber.js';

import type { ILocalWalletFrozenPart, ILocalWalletPoolBalance } from './types';

// The account's frozen parts: every pool's, summed per reason.
export function sumLocalWalletFrozen(
  pools: ILocalWalletPoolBalance[],
): ILocalWalletFrozenPart[] {
  const totals = new Map<ILocalWalletFrozenPart['reason'], BigNumber>();
  for (const part of pools.flatMap((pool) => pool.frozen ?? [])) {
    totals.set(
      part.reason,
      (totals.get(part.reason) ?? new BigNumber(0)).plus(part.amountParsed),
    );
  }
  return [...totals].map(([reason, amount]) => ({
    reason,
    amountParsed: amount.toFixed(),
  }));
}
