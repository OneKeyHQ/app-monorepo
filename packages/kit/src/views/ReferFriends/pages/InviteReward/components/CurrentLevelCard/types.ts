import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface ICurrentLevelCardProps {
  rebateConfig: IInviteSummary['rebateConfig'];
  rebateLevels: IInviteSummary['rebateLevels'];
}

export interface IUseCurrentLevelCardReturn {
  currentLevel: IInviteSummary['rebateConfig'];
  levelIcon: string;
  levelLabel: string;
  commissionRates: Array<{
    subject: string;
    rate: {
      you: number;
      invitee: number;
      label: string;
    };
  }>;
}
