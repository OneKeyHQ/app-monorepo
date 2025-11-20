import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export enum EInvitationDetailsTab {
  REWARD = 'reward',
  REFERRAL = 'referral',
}

export interface IInvitationDetailsSectionProps {
  summaryInfo: IInviteSummary | undefined;
}
