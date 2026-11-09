import { sortCommissionRateItems } from '@onekeyhq/kit/src/views/ReferFriends/utils';
import type { IReferralShareSource } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const PERPS_LINK = {
  subject: 'Perp',
  pathSuffix: '/app/perps',
  titleId: ETranslations.perps_perps,
  descId: ETranslations.referral_link_perps_desc,
  useWebAppUrl: true,
};

const SWAP_LINK = {
  subject: 'Swap',
  pathSuffix: '/app/swap',
  titleId: ETranslations.global_swap,
  descId: ETranslations.swap_referral_link__desc,
  useWebAppUrl: true,
};

const EARN_LINK = {
  subject: 'Earn',
  pathSuffix: '/app/defi',
  titleId: ETranslations.referral_link_defi_title,
  descId: ETranslations.referral_link_defi_desc,
  useWebAppUrl: true,
};

const REFERRAL_LINKS = [
  {
    subject: 'HardwareSales',
    pathSuffix: '/shop',
    titleId: ETranslations.referral_link_hw_title,
    descId: ETranslations.referral_link_hw_desc,
    useWebAppUrl: false,
  },
  PERPS_LINK,
  SWAP_LINK,
  EARN_LINK,
];

// The product page each activity hub shares, as listed in the link menu.
const SHARE_SOURCE_LINK: Record<IReferralShareSource, typeof PERPS_LINK> = {
  Earn: EARN_LINK,
  Perps: PERPS_LINK,
  Swap: SWAP_LINK,
};

function buildWebAppReferralUrl({
  webAppUrl,
  inviteCode,
  pathSuffix,
}: {
  webAppUrl: string;
  inviteCode: string;
  pathSuffix: string;
}) {
  return `${webAppUrl}/r/${inviteCode}${pathSuffix}`;
}

// A product's referral link and what it invites friends to, exactly as the
// link menu lists them.
export function getProductReferralLink({
  source,
  inviteCode,
  webAppUrl,
}: {
  source: IReferralShareSource;
  inviteCode: string;
  webAppUrl: string;
}): { url: string; descId: ETranslations } {
  const link = SHARE_SOURCE_LINK[source];
  return {
    url: buildWebAppReferralUrl({
      webAppUrl,
      inviteCode,
      pathSuffix: link.pathSuffix,
    }),
    descId: link.descId,
  };
}

function extractInviteCode(url: string): string | undefined {
  try {
    return new URL(url).pathname.match(/^\/r\/([^/]+)/)?.[1];
  } catch {
    return undefined;
  }
}

function appendReferralPath(inviteUrl: string, pathSuffix: string) {
  try {
    const url = new URL(inviteUrl);
    url.pathname = `${url.pathname}${pathSuffix}`;
    return url.toString();
  } catch {
    return `${inviteUrl}${pathSuffix}`;
  }
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
        ? buildWebAppReferralUrl({
            webAppUrl,
            inviteCode,
            pathSuffix: link.pathSuffix,
          })
        : appendReferralPath(inviteUrl, link.pathSuffix),
  }));
}

export function buildHardwareShopInviteUrl(inviteUrl: string) {
  const hardwareLink = REFERRAL_LINKS.find(
    (link) => link.subject === 'HardwareSales',
  );
  if (!inviteUrl || !hardwareLink) {
    return '';
  }
  return appendReferralPath(inviteUrl, hardwareLink.pathSuffix);
}
