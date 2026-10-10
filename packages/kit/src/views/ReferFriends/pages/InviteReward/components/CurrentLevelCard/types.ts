import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface ICurrentLevelCardProps {
  rebateConfig: IInviteSummary['rebateConfig'];
  rebateLevels: IInviteSummary['rebateLevels'];
}

export interface IUseCurrentLevelCardReturn {
  levelLabel: string;
  levelIcon: string;
  commissionRates: Array<{
    subject: string;
    rate: {
      you: number;
      invitee: number;
      label: string;
      enabled: boolean;
    };
  }>;
}
