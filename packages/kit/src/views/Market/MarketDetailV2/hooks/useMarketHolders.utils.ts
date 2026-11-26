import BigNumber from 'bignumber.js';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketTokenDetail,
  IMarketTokenHolder,
} from '@onekeyhq/shared/types/marketV2';

export function getUniqueMarketHolders(holders: IMarketTokenHolder[]) {
  const uniqueHolders = new Map<string, IMarketTokenHolder>();
  for (const holder of holders) {
    const previous = uniqueHolders.get(holder.accountAddress);
    if (previous) {
      // These are wallet balances, not deltas; conflicting totals cannot be combined.
      if (
        (previous.amount !== holder.amount &&
          !new BigNumber(previous.amount).eq(holder.amount)) ||
        (previous.fiatValue !== holder.fiatValue &&
          !new BigNumber(previous.fiatValue).eq(holder.fiatValue))
      ) {
        throw new OneKeyError('Conflicting token holder balances');
      }
    } else {
      uniqueHolders.set(holder.accountAddress, holder);
    }
  }
  return Array.from(uniqueHolders.values());
}

export function buildMarketHolderPercentages({
  holders,
  tokenDetail,
}: {
  holders: IMarketTokenHolder[];
  tokenDetail?: IMarketTokenDetail;
}) {
  if (!tokenDetail?.fdv || !tokenDetail.price) {
    return holders;
  }

  const fdv = new BigNumber(tokenDetail.fdv);
  const price = new BigNumber(tokenDetail.price);
  if (!fdv.isFinite() || !price.isFinite() || !fdv.gt(0) || !price.gt(0)) {
    return holders;
  }

  const totalSupply = fdv.dividedBy(price);
  return holders.map((holder) => {
    const holderAmount = new BigNumber(holder.amount);
    if (!holderAmount.isFinite()) {
      return holder;
    }

    return {
      ...holder,
      percentage: holderAmount
        .dividedBy(totalSupply)
        .multipliedBy(100)
        .toFixed(2),
    };
  });
}
