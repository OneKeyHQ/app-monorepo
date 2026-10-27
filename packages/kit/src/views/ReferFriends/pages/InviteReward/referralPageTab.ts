import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';

export type { IReferralPageTab };

export const EReferralPageTab = {
  invite: 'invite',
  benefits: 'benefits',
} as const satisfies Record<IReferralPageTab, IReferralPageTab>;

// Turn off to hide the Perks tab; deep links then fall back to invite.
export const IS_BENEFITS_TAB_ENABLED = true;

export function resolveReferralPageTab(
  tab?: string | null,
  isBenefitsTabEnabled = IS_BENEFITS_TAB_ENABLED,
): IReferralPageTab {
  return isBenefitsTabEnabled && tab === EReferralPageTab.benefits
    ? EReferralPageTab.benefits
    : EReferralPageTab.invite;
}
