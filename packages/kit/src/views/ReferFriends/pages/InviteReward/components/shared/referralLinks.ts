import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const REFERRAL_LINKS = [
  {
    subject: 'HardwareSales',
    pathSuffix: '/shop',
    titleId: ETranslations.referral_link_hw_title,
    descId: ETranslations.referral_link_hw_desc,
    useWebAppUrl: false,
  },
  {
    subject: 'Perp',
    pathSuffix: '/app/perps',
    titleId: ETranslations.referral_link_perps_title,
    descId: ETranslations.referral_link_perps_desc,
    useWebAppUrl: true,
  },
  {
    subject: 'Swap',
    pathSuffix: '/app/swap',
    titleId: ETranslations.swap_referral_link__title,
    descId: ETranslations.swap_referral_link__desc,
    useWebAppUrl: true,
  },
  {
    subject: 'Earn',
    pathSuffix: '/app/defi',
    titleId: ETranslations.referral_link_defi_title,
    descId: ETranslations.referral_link_defi_desc,
    useWebAppUrl: true,
  },
];

function extractInviteCode(url: string): string | undefined {
  const match = url.match(/\/r\/([^/]+)/);
  return match?.[1];
}

export function buildReferralLinks({
  inviteUrl,
  webAppUrl,
}: {
  inviteUrl: string;
  webAppUrl: string;
}) {
  const inviteCode = extractInviteCode(inviteUrl);
  return sortCommissionRateItems(REFERRAL_LINKS).map((link) => ({
    ...link,
    url:
      link.useWebAppUrl && inviteCode
        ? `${webAppUrl}/r/${inviteCode}${link.pathSuffix}`
        : `${inviteUrl}${link.pathSuffix}`,
  }));
}
