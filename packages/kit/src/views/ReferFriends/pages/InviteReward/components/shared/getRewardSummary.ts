import BigNumber from 'bignumber.js';

import { toAmount } from '@onekeyhq/kit/src/views/ReferFriends/utils/amountUtils';
import type { IRewardToken } from '@onekeyhq/shared/src/referralCode/type';

// Referral rewards are paid in USDC, so every reward figure is shown in USD
// regardless of the wallet currency: it matches what arrives and does not
// move with exchange rates. Spread onto <Currency>.
export const REFERRAL_USD_CURRENCY_PROPS = {
  sourceCurrency: 'usd',
  targetCurrency: 'usd',
} as const;

export interface IRewardSummaryItem {
  token: IRewardToken;
  amount: string;
  fiatValue: string;
  usdValue?: string;
}

// Totals for one product. Display is always fiat (USD), so token metadata is
// not carried; `usdValue` is set only when every item has one.
export interface IRewardSummary {
  fiatValue: string;
  usdValue?: string;
  hasReward: boolean;
}

function sumFinite(values: readonly (string | undefined)[]) {
  return values.reduce(
    (sum, value) => sum.plus(toAmount(value)),
    new BigNumber(0),
  );
}

export function getRewardSummary(
  rewards: readonly IRewardSummaryItem[],
): IRewardSummary {
  const tokenTotal = sumFinite(rewards.map((reward) => reward.amount));
  const fiatTotal = sumFinite(rewards.map((reward) => reward.fiatValue));
  // Only a complete USD total is usable; a partial one would mix bases.
  const hasUsdValues = rewards.every((reward) =>
    new BigNumber(reward.usdValue ?? NaN).isFinite(),
  );

  return {
    fiatValue: fiatTotal.toFixed(),
    usdValue: hasUsdValues
      ? sumFinite(rewards.map((reward) => reward.usdValue)).toFixed()
      : undefined,
    hasReward: tokenTotal.isGreaterThan(0) || fiatTotal.isGreaterThan(0),
  };
}
