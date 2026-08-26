import BigNumber from 'bignumber.js';

import type { IRewardToken } from '@onekeyhq/shared/src/referralCode/type';

export interface IRewardSummaryItem {
  token: IRewardToken;
  amount: string;
  fiatValue: string;
}

export type IRewardSummary =
  | {
      kind: 'token';
      amount: string;
      hasReward: boolean;
      token: IRewardToken | undefined;
    }
  | {
      kind: 'fiat';
      fiatValue: string;
      hasReward: boolean;
    };

export function getRewardSummary(
  rewards: readonly IRewardSummaryItem[],
): IRewardSummary {
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

  const hasReward = tokenTotal.isGreaterThan(0) || fiatTotal.isGreaterThan(0);

  if (isSingleToken) {
    return {
      kind: 'token',
      amount: tokenTotal.toFixed(),
      hasReward,
      token: firstToken,
    };
  }

  return {
    kind: 'fiat',
    fiatValue: fiatTotal.toFixed(),
    hasReward,
  };
}
