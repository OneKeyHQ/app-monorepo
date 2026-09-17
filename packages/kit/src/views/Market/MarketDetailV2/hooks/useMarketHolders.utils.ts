import BigNumber from 'bignumber.js';

import type {
  IMarketTokenDetail,
  IMarketTokenHolder,
} from '@onekeyhq/shared/types/marketV2';

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
