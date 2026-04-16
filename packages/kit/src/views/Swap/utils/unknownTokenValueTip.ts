import BigNumber from 'bignumber.js';

import type {
  IFetchQuoteResult,
  IQuoteTip,
} from '@onekeyhq/shared/types/swap/types';

export function attachUnknownTokenValueTip({
  quoteResult,
  toTokenPrice,
  quoteTip,
}: {
  quoteResult: IFetchQuoteResult;
  toTokenPrice?: string;
  quoteTip?: IQuoteTip;
}) {
  if (quoteResult.quoteShowTip || !quoteTip) {
    return quoteResult;
  }

  const toAmountBN = new BigNumber(quoteResult.toAmount ?? 0);
  const toTokenPriceBN = new BigNumber(toTokenPrice ?? 0);

  if (toAmountBN.isNaN()) {
    return quoteResult;
  }

  const receiveFiatValueBN = toAmountBN.multipliedBy(
    toTokenPriceBN.isNaN() ? 0 : toTokenPriceBN,
  );

  if (!receiveFiatValueBN.isNaN() && receiveFiatValueBN.gt(0)) {
    return quoteResult;
  }

  return {
    ...quoteResult,
    quoteShowTip: quoteTip,
  };
}
