import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export type IPerpsRewardBalances = IInviteSummary['Perp']['available'];

export interface IPerpsRewardProps {
  perpsRewards: IPerpsRewardBalances;
}
