import type { IPerpsCumulativeRewardsResponse } from '@onekeyhq/shared/src/referralCode/type';

export interface IPerpsRewardProps {
  perpsCumulativeRewards: IPerpsCumulativeRewardsResponse | undefined;
  isLoading?: boolean;
}
