import BigNumber from 'bignumber.js';

import type {
  IRebateUserInviteSummary,
  IRewardToken,
} from '@onekeyhq/shared/src/referralCode/type';

export interface ISwapRewardSummary {
  amount: string;
  hasReward: boolean;
  isSingleToken: boolean;
  token: IRewardToken | undefined;
}

export function getSwapRewardSummary(
  rewards: readonly IRebateUserInviteSummary[],
): ISwapRewardSummary {
  const firstToken = rewards[0]?.token;
  const isSingleToken = rewards.every(
    ({ token }) =>
      token.networkId === firstToken?.networkId &&
      token.address === firstToken?.address,
  );
  const tokenTotal = rewards.reduce((sum, reward) => {
    const amount = new BigNumber(reward.amount);
    return amount.isFinite() ? sum.plus(amount) : sum;
  }, new BigNumber(0));
  const fiatTotal = rewards.reduce((sum, reward) => {
    const fiatValue = new BigNumber(reward.fiatValue);
    return fiatValue.isFinite() ? sum.plus(fiatValue) : sum;
  }, new BigNumber(0));

  return {
    amount: (isSingleToken ? tokenTotal : fiatTotal).toFixed(),
    hasReward: tokenTotal.isGreaterThan(0) || fiatTotal.isGreaterThan(0),
    isSingleToken,
    token: isSingleToken ? firstToken : undefined,
  };
}
