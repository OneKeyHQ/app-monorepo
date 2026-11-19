import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

// Copy shared by the invite and Perks tabs: the Perks intro, the compact tab
// switch and the links between the two tabs.
export function useReferralTabCopy() {
  const intl = useIntl();
  return useMemo(
    () => ({
      // Says outright that Perks is the invitee's side of referrals.
      perksIntro: intl.formatMessage({
        id: ETranslations.referral_perks_invitee_role__desc,
      }),
      // Who the invite tab is for, beside Perks in the compact tab switch.
      inviteRole: intl.formatMessage({
        id: ETranslations.referral_perks_inviter_role__desc,
      }),
      toPerksPrompt: intl.formatMessage({
        id: ETranslations.referral_perks_joined_with_code__desc,
      }),
      toPerksAction: intl.formatMessage({
        id: ETranslations.earn_referral_view_rewards,
      }),
      toInvitePrompt: intl.formatMessage({
        id: ETranslations.referral_perks_invite_too__desc,
      }),
      toInviteAction: intl.formatMessage({
        id: ETranslations.referral_perks_earn_commission__action,
      }),
    }),
    [intl],
  );
}
