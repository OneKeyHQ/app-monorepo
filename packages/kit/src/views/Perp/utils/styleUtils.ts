import type { ColorTokens } from 'tamagui';

export type ITradeSide = 'long' | 'short';
export type IPerpActionButtonVariant = 'accent' | 'destructive';

interface IPerpActionButtonStyleProps {
  bg: ColorTokens;
  hoverStyle: { bg: ColorTokens };
  pressStyle: { bg: ColorTokens };
  textColor: ColorTokens;
}

// Accent is shared by Long and Deposit; destructive is used for Short.
// Keep references stable for memoized native button consumers.
const ACTION_BUTTON_STYLE_PROPS: Record<
  IPerpActionButtonVariant,
  IPerpActionButtonStyleProps
> = {
  accent: {
    bg: '$bgAccent',
    hoverStyle: { bg: '$bgAccentHover' },
    pressStyle: { bg: '$bgAccentActive' },
    textColor: '$textInverse',
  },
  destructive: {
    bg: '$bgCriticalStrong',
    hoverStyle: { bg: '$bgCriticalStrongHover' },
    pressStyle: { bg: '$bgCriticalStrongActive' },
    textColor: '$textOnColor',
  },
};

/**
 * Adapt trading sides to the shared action-button palette.
 */
export function getTradingButtonStyleProps(
  side: ITradeSide,
): IPerpActionButtonStyleProps {
  // Button owns disabled opacity; preserve the paired foreground color.
  return getPerpActionButtonStyleProps(
    side === 'long' ? 'accent' : 'destructive',
  );
}

export function getPerpActionButtonStyleProps(
  variant: IPerpActionButtonVariant,
): IPerpActionButtonStyleProps {
  return ACTION_BUTTON_STYLE_PROPS[variant];
}

export function getTradingButtonStyleValues(side: ITradeSide) {
  const styles = getTradingButtonStyleProps(side);
  return {
    bg: styles.bg,
    hoverBg: styles.hoverStyle.bg,
    pressBg: styles.pressStyle.bg,
    textColor: styles.textColor,
  };
}

export function GetTradingButtonStyleProps(side: ITradeSide) {
  return getTradingButtonStyleProps(side);
}

export function getTradingSideTextColor(
  side: ITradeSide,
): '$green11' | '$red11' {
  return side === 'long' ? '$green11' : '$red11';
}
