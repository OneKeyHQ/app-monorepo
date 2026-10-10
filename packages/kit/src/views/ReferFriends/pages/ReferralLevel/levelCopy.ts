import { ETranslations } from '@onekeyhq/shared/src/locale';

// Level-up targets are monthly; headings say "this month", so rows use short
// names instead of the backend's "Monthly ..." labels.
export const LEVEL_TARGET_LABEL_IDS: Partial<Record<string, ETranslations>> = {
  HardwareSales: ETranslations.referral_referred_type_3,
  Perp: ETranslations.referral_target_perps__title,
  Swap: ETranslations.referral_target_swap__title,
};

// Product names in the compact level table's row headers, where each column
// is a few characters wide.
export const LEVEL_SUBJECT_SHORT_LABEL_IDS: Partial<
  Record<string, ETranslations>
> = {
  HardwareSales: ETranslations.referral_subject_hardware__title,
  Perp: ETranslations.referral_perps,
  Swap: ETranslations.swap_referral_link__title,
  Earn: ETranslations.referral_referred_type_2,
  Onchain: ETranslations.referral_referred_type_2,
};
