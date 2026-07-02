import type { ColorTokens } from 'tamagui';

export type ITradeSide = 'long' | 'short';

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

export function getTradingButtonStyleValues(
  side: ITradeSide,
  disabled = false,
) {
  const styles = getTradingButtonStyleProps(side, disabled);
  return {
    bg: styles.bg,
    hoverBg: styles.hoverStyle.bg,
    pressBg: styles.pressStyle.bg,
    textColor: styles.textColor,
  };
}

export function GetTradingButtonStyleProps(side: ITradeSide, disabled = false) {
  return getTradingButtonStyleProps(side, disabled);
}

export function getTradingSideTextColor(
  side: ITradeSide,
): '$green11' | '$red11' {
  return side === 'long' ? '$green11' : '$red11';
}
