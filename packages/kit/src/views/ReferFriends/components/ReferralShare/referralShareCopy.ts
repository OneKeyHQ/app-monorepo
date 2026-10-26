import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// Names, not copy: they stay untranslated.
export const REFERRAL_SHARE_NAMES = {
  brand: 'OneKey',
  x: 'X',
  telegram: 'Telegram',
} as const;

export interface IReferralShareCopy {
  // The card headline as one sentence; its `{rate}` is highlighted where it
  // appears, so translations can place it anywhere.
  headlineId: ETranslations;
  rate?: string;
  // The message that goes with the link on X and Telegram.
  shareText: string;
}

// The card speaks to the invitee, so it leads with what they get: the best
// invitee discount across products. Without one it falls back to a plain
// invitation rather than promising a discount.
export function getReferralShareCopy(
  intl: IntlShape,
  inviteeRate: string | null | undefined,
): IReferralShareCopy {
  if (inviteeRate) {
    return {
      headlineId: ETranslations.referral_share_headline__title,
      rate: inviteeRate,
      shareText: intl.formatMessage(
        { id: ETranslations.referral_share_text__desc },
        { rate: inviteeRate },
      ),
    };
  }
  return {
    headlineId: ETranslations.referral_share_headline_plain__title,
    shareText: intl.formatMessage({
      id: ETranslations.referral_share_text_plain__desc,
    }),
  };
}

// Telegram only accepts text and a link; the image goes through the system
// share sheet ("More") or "Save". X uses the shared useShareActions intent.
export function buildTelegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    url,
  )}&text=${encodeURIComponent(text)}`;
}
