import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import type { ColorTokens } from 'tamagui';

export type ITradeSide = 'long' | 'short';

/**
 * Get trading button style props based on side and disabled state
 */
export const PERP_TRADE_BUTTON_COLORS = {
  light: {
    long: '#008236',
    longHover: '#016630',
    longPress: '#0D542B',
    short: '$red11',
    shortHover: '#9C2125',
    shortPress: '#72181B',
  },
  dark: {
    long: '$green8',
    longHover: '$green7',
    longPress: '$green6',
    short: '$red8',
    shortHover: '$red7',
    shortPress: '$red6',
  },
};

export function GetTradingButtonStyleProps(side: ITradeSide, disabled = false) {
  const themeVariant = useThemeVariant();
  const isLong = side === 'long';
  const colors = PERP_TRADE_BUTTON_COLORS[themeVariant];

  return {
    bg: colors[isLong ? 'long' : 'short'],
    hoverStyle: { bg: colors[isLong ? 'longHover' : 'shortHover'] },
    pressStyle: { bg: colors[isLong ? 'longPress' : 'shortPress'] },
    textColor: (disabled ? '$textDisabled' : '$textOnColor') as ColorTokens,
  };
}

export function getTradingSideTextColor(side: ITradeSide): string {
  return side === 'long' ? '$green11' : '$red11';
}
