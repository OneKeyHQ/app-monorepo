import type { IColorTokens, IIconProps } from '@onekeyhq/components';

// Supported risk indicator types
export type IRiskIndicatorType = 'unknown' | 'safe' | 'danger' | 'info';

export interface IRiskIndicatorConfig {
  iconName: IIconProps['name'];
  iconColor: IColorTokens;
  titleColor: IColorTokens;
  /** Title text shown in RiskIndicatorCard */
  cardTitle: string;
  /** Description text shown in RiskIndicatorCard */
  cardDescription: string;
}

// Fixed config mapping for each risk indicator type
const CONFIG: Record<IRiskIndicatorType, IRiskIndicatorConfig> = {
  unknown: {
    iconName: 'ShieldQuestionSolid',
    iconColor: '$iconSubdued',
    titleColor: '$text',
    cardTitle: 'Unknown',
    cardDescription:
      'This token does not have enough data for a security assessment.',
  },
  safe: {
    iconName: 'ShieldCheckDoneSolid',
    iconColor: '$iconSuccess',
    titleColor: '$text',
    cardTitle: 'Audited',
    cardDescription:
      'This token has passed a reputable audit and is considered low-risk.',
  },
  danger: {
    iconName: 'ShieldExclamationSolid',
    iconColor: '$iconCritical',
    titleColor: '$textCritical',
    cardTitle: 'High Risk',
    cardDescription:
      'Suspicious activity detected. Proceed with caution when trading or interacting with this token.',
  },
  info: {
    iconName: 'BookOutline',
    iconColor: '$icon',
    titleColor: '$text',
    cardTitle: 'Information',
    cardDescription: "Learn more about this token's background and metrics.",
  },
};

/**
 * Hook to obtain UI config for a given risk indicator type.
 * This keeps the mapping logic in a single place so it can be reused
 * by both RiskIndicatorCard and RiskIndicatorIcon.
 */
export function useRiskIndicator(
  type: IRiskIndicatorType,
): IRiskIndicatorConfig {
  return CONFIG[type];
}
