import { fillCopy } from '../../pages/InviteReward/copyTemplate';

// Hardcoded English until copy review; then move to Lokalise keys. `brand`,
// `x` and `telegram` are names and stay untranslated.
export const REFERRAL_SHARE_COPY = {
  brand: 'OneKey',
  scanToJoin: 'Scan to join OneKey',
  headline: 'Get up to {rate} off fees on OneKey',
  headlineNoDiscount: 'Join me on OneKey',
  shareText: 'Join me on OneKey and get up to {rate} off fees.',
  shareTextNoDiscount: 'Join me on OneKey.',
  x: 'X',
  telegram: 'Telegram',
} as const;

export interface IReferralShareCopy {
  // The card headline as one sentence; `{rate}` is highlighted where it
  // appears, so translations can place it anywhere.
  headline: string;
  rate?: string;
  // The message that goes with the link on X and Telegram.
  shareText: string;
}

// The card speaks to the invitee, so it leads with what they get: the best
// invitee discount across products. Without one it falls back to a plain
// invitation rather than promising a discount.
export function getReferralShareCopy(
  inviteeRate: string | null | undefined,
): IReferralShareCopy {
  if (inviteeRate) {
    return {
      headline: REFERRAL_SHARE_COPY.headline,
      rate: inviteeRate,
      shareText: fillCopy(REFERRAL_SHARE_COPY.shareText, {
        rate: inviteeRate,
      }),
    };
  }
  return {
    headline: REFERRAL_SHARE_COPY.headlineNoDiscount,
    shareText: REFERRAL_SHARE_COPY.shareTextNoDiscount,
  };
}

// Telegram only accepts text and a link; the image goes through the system
// share sheet ("More") or "Save". X uses the shared useShareActions intent.
export function buildTelegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    url,
  )}&text=${encodeURIComponent(text)}`;
}
