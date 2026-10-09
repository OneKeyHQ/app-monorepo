// Hardcoded English until copy review; then move to Lokalise keys.
export const REFERRAL_SHARE_COPY = {
  brand: 'OneKey',
  codeLabel: 'Referral code',
  scanToJoin: 'Scan to join OneKey',
  x: 'X',
  telegram: 'Telegram',
} as const;

export interface IReferralShareCopy {
  // The card headline in three runs so the rate can be highlighted:
  // "Get up to " + "10%" + " off fees on OneKey".
  headlineLead: string;
  headlineRate?: string;
  headlineTail: string;
  // The message that goes with the link on X and Telegram.
  shareText: string;
}

// The card speaks to the friend being invited, so it leads with what they
// get: the best invitee discount across products. Without one it falls back
// to a plain invitation rather than promising a discount.
export function getReferralShareCopy(
  inviteeRate: string | null | undefined,
): IReferralShareCopy {
  if (inviteeRate) {
    return {
      headlineLead: 'Get up to ',
      headlineRate: inviteeRate,
      headlineTail: ' off fees on OneKey',
      shareText: `Join me on OneKey and get up to ${inviteeRate} off fees.`,
    };
  }
  return {
    headlineLead: 'Join me on OneKey',
    headlineTail: '',
    shareText: 'Join me on OneKey.',
  };
}

// Telegram only accepts text and a link; the image goes through the system
// share sheet ("More") or "Save". X uses the shared useShareActions intent.
export function buildTelegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    url,
  )}&text=${encodeURIComponent(text)}`;
}
