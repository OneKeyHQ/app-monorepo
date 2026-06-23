import BigNumber from 'bignumber.js';

import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

type ILimitOrderDisplayAmountInput = {
  executedBuyAmount?: IFetchLimitOrderRes['executedBuyAmount'];
  executedSellAmount?: IFetchLimitOrderRes['executedSellAmount'];
  fromAmount?: IFetchLimitOrderRes['fromAmount'];
  fromTokenInfo?: Pick<IFetchLimitOrderRes['fromTokenInfo'], 'decimals'>;
  toAmount?: IFetchLimitOrderRes['toAmount'];
  toTokenInfo?: Pick<IFetchLimitOrderRes['toTokenInfo'], 'decimals'>;
};

export function getLimitOrderDisplayAmounts({
  executedBuyAmount,
  executedSellAmount,
  fromAmount,
  fromTokenInfo,
  toAmount,
  toTokenInfo,
}: ILimitOrderDisplayAmountInput) {
  const executedBuyAmountBN = new BigNumber(executedBuyAmount ?? '0');
  const executedSellAmountBN = new BigNumber(executedSellAmount ?? '0');
  const shouldUseExecutedAmounts =
    executedBuyAmountBN.isFinite() &&
    executedBuyAmountBN.gt(0) &&
    executedSellAmountBN.isFinite() &&
    executedSellAmountBN.gt(0);
  const displayFromAmount = shouldUseExecutedAmounts
    ? (executedSellAmount ?? '0')
    : (fromAmount ?? '0');
  const displayToAmount = shouldUseExecutedAmounts
    ? (executedBuyAmount ?? '0')
    : (toAmount ?? '0');

  return {
    displayFromAmount: new BigNumber(displayFromAmount).shiftedBy(
      -(fromTokenInfo?.decimals ?? 0),
    ),
    displayToAmount: new BigNumber(displayToAmount).shiftedBy(
      -(toTokenInfo?.decimals ?? 0),
    ),
  };
}
