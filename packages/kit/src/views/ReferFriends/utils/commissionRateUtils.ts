// Priority order: Hardware(0) > Perp/Contract(1) > DeFi/Onchain(2) > Others(99)
// Uses labelKey (translation key) or subject (Record key) for stable matching,
// independent of display text and i18n locale.
const COMMISSION_RATE_PRIORITY_MAP: Record<string, number> = {
  // Hardware — labelKey or subject
  HardwareSales: 0,
  'referral.referred_type_3': 0,
  'referral.hardware_sale': 0,

  // Perp/Contract — labelKey or subject
  Perp: 1,
  'referral.perps': 1,

  // DeFi/Onchain — labelKey or subject
  Onchain: 2,
  'referral.referred_type_2': 2,
};

export function getCommissionRateSortPriority(
  ...keys: (string | undefined)[]
): number {
  for (const key of keys) {
    if (key && key in COMMISSION_RATE_PRIORITY_MAP) {
      return COMMISSION_RATE_PRIORITY_MAP[key];
    }
  }
  return 99;
}
