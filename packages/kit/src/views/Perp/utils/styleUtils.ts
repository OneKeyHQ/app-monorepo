import type { ColorTokens } from 'tamagui';

export type ITradeSide = 'long' | 'short';

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

interface ITradingButtonStyleProps {
  bg: ColorTokens;
  hoverStyle: { bg: ColorTokens };
  pressStyle: { bg: ColorTokens };
  textColor: ColorTokens;
}

// Long = design-system "accent", short = "destructive". These semantic tokens
// are theme-aware (same rationale as TradingButtonGroup's
// PERP_SIDE_BUTTON_STYLES), so no light/dark branching is needed. Frozen
// module-level constants keep the returned reference stable across renders, so
// consumers that memoize on it (e.g. PerpMarketFooter.android) don't rebuild
// their button subtrees on every render.
const TRADING_BUTTON_STYLE_PROPS: Record<ITradeSide, ITradingButtonStyleProps> =
  {
    long: {
      bg: '$bgAccent',
      hoverStyle: { bg: '$bgAccentHover' },
      pressStyle: { bg: '$bgAccentActive' },
      textColor: '$textInverse',
    },
    short: {
      bg: '$bgCriticalStrong',
      hoverStyle: { bg: '$bgCriticalStrongHover' },
      pressStyle: { bg: '$bgCriticalStrongActive' },
      textColor: '$textOnColor',
    },
  };

/**
 * Get trading button style props based on side and disabled state.
 */
export function getTradingButtonStyleProps(
  side: ITradeSide,
  disabled = false,
): ITradingButtonStyleProps {
  const styles = TRADING_BUTTON_STYLE_PROPS[side];
  return disabled ? { ...styles, textColor: '$textDisabled' } : styles;
}

export function getTradingSideTextColor(
  side: ITradeSide,
): '$green11' | '$red11' {
  return side === 'long' ? '$green11' : '$red11';
}
