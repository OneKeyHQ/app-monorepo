import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Pointer layouts list Referral in the sidebar, so their hub shows the invite
// panel (code and link to copy). Native has no Referral tab, so its entries go
// to the referral page itself.
export function shouldShowActivityHubInvitePanel() {
  return !platformEnv.isNative;
}

// The floating hub panel is wide enough for the invite link and the campaign
// cards; shortcut tiles sit four to a row.
export const ACTIVITY_HUB_PANEL_WIDTH = 384;

export type IActivityHubShortcutBasis = `${number}%`;

export const ACTIVITY_HUB_SHORTCUT_BASIS: IActivityHubShortcutBasis = '25%';

// The hub is named after what it holds: with campaigns it is the activity
// hub; the invite panel alone is about inviting friends.
export function getActivityHubTitleId({
  hasCampaigns,
  showInvitePanel,
}: {
  hasCampaigns: boolean;
  showInvitePanel: boolean;
}): ETranslations {
  return showInvitePanel && !hasCampaigns
    ? ETranslations.referral_home__title
    : ETranslations.perps_activity_hub;
}
