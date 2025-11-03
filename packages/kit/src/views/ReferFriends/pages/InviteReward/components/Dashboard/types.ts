import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface IDashboardProps {
  onChain: IInviteSummary['Onchain'];
  hardwareSales: IInviteSummary['HardwareSales'];
  levelPercent: number;
  rebateLevels: IInviteSummary['rebateLevels'];
  rebateConfig: IInviteSummary['rebateConfig'];
}
