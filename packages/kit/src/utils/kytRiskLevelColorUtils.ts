import type { ColorTokens } from '@onekeyhq/components';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

// Orange marks High so the four scored KYT levels read green / amber / orange /
// red across the address risk check and incoming-transfer screening. The
// design system has no semantic orange, so these follow the same palette steps
// the semantic tokens use: 11 for text, 9 for solid fills and 3 for subtle
// backgrounds. Palette tokens switch with the light/dark theme.
const KYT_HIGH_RISK_COLOR = {
  text: '$orange11',
  solid: '$orange9',
  subtle: '$orange3',
} as const satisfies Record<string, ColorTokens>;

export const KYT_LEVEL_TEXT_COLOR: Record<EKytRiskLevel, ColorTokens> = {
  [EKytRiskLevel.None]: '$textSuccess',
  [EKytRiskLevel.Checking]: '$textSubdued',
  [EKytRiskLevel.Failed]: '$textSubdued',
  [EKytRiskLevel.Low]: '$textSuccess',
  [EKytRiskLevel.Moderate]: '$textCaution',
  [EKytRiskLevel.High]: KYT_HIGH_RISK_COLOR.text,
  [EKytRiskLevel.Severe]: '$textCritical',
};

// Solid fills for the four scored levels (score meter segments and dots).
// Moderate uses amber instead of the semantic caution fill: that pale lemon
// nearly disappears on light cards, while amber stays visible and still reads
// clearly apart from the High orange in both themes.
export const KYT_LEVEL_SOLID_COLOR: Partial<
  Record<EKytRiskLevel, ColorTokens>
> = {
  [EKytRiskLevel.Low]: '$bgSuccessStrong',
  [EKytRiskLevel.Moderate]: '$amber9',
  [EKytRiskLevel.High]: KYT_HIGH_RISK_COLOR.solid,
  [EKytRiskLevel.Severe]: '$bgCriticalStrong',
};

// Badge has no orange type: High keeps its badge type and overrides the frame
// (`bg`) and text (`color`) colors. Other levels use the badge type as is.
export function getKytBadgeColorOverride(
  level: EKytRiskLevel | undefined,
): { bg: ColorTokens; color: ColorTokens } | undefined {
  return level === EKytRiskLevel.High
    ? { bg: KYT_HIGH_RISK_COLOR.subtle, color: KYT_HIGH_RISK_COLOR.text }
    : undefined;
}
