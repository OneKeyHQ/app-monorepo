import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface ISwapRewardProps {
  swapRewards: NonNullable<IInviteSummary['Onchain']['swap']>;
}
