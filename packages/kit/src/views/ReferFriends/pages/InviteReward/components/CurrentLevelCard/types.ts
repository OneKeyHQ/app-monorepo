import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export type ICurrentLevelCardProps = Pick<
  IInviteSummary,
  'rebateConfig' | 'rebateLevels' | 'configs' | 'partnerPlan'
>;

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
