import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';

export type { IReferralPageTab };

export const EReferralPageTab = {
  invite: 'invite',
  benefits: 'benefits',
} as const satisfies Record<IReferralPageTab, IReferralPageTab>;

export function resolveReferralPageTab(tab?: string | null): IReferralPageTab {
  return tab === EReferralPageTab.benefits
    ? EReferralPageTab.benefits
    : EReferralPageTab.invite;
}
