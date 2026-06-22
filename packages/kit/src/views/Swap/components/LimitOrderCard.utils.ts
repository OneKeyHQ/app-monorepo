import BigNumber from 'bignumber.js';

import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

type ILimitOrderDisplayAmountInput = Pick<
  IFetchLimitOrderRes,
  'executedBuyAmount' | 'toAmount'
> & {
  toTokenInfo?: Pick<IFetchLimitOrderRes['toTokenInfo'], 'decimals'>;
};

export function getLimitOrderDisplayToAmount({
  executedBuyAmount,
  toAmount,
  toTokenInfo,
}: ILimitOrderDisplayAmountInput) {
  const executedBuyAmountBN = new BigNumber(executedBuyAmount ?? '0');
  const rawDisplayAmount =
    executedBuyAmountBN.isFinite() && executedBuyAmountBN.gt(0)
      ? executedBuyAmount
      : toAmount;

  return new BigNumber(rawDisplayAmount ?? '0').shiftedBy(
    -(toTokenInfo?.decimals ?? 0),
  );
}
