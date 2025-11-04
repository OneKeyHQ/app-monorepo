import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface IHardwareSalesRewardProps {
  hardwareSales: IInviteSummary['HardwareSales'];
  levelPercent: number;
  rebateLevels: IInviteSummary['rebateLevels'];
  rebateConfig: IInviteSummary['rebateConfig'];
}
