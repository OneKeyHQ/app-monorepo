import type { ColorTokens } from 'tamagui';

export type ITradeSide = 'long' | 'short';

/**
 * Get trading button style props based on side and disabled state
 */
export function getTradingButtonStyleProps(side: ITradeSide, disabled = false) {
  const isLong = side === 'long';

  return {
    bg: isLong ? '#18794E' : '#E5484D',
    hoverStyle: { bg: isLong ? '$green8' : '$red8' },
    pressStyle: { bg: isLong ? '$green8' : '$red8' },
    textColor: (disabled ? '$textDisabled' : '$textOnColor') as ColorTokens,
  };
}

export function getTradingSideTextColor(side: ITradeSide): string {
  return side === 'long' ? '$green10' : '$red10';
}

export function getTradingSideBgColor(
  side: ITradeSide,
  opacity?: 'light' | 'medium' | 'dark',
): string {
  const isLong = side === 'long';

  switch (opacity) {
    case 'light':
      return isLong ? '$green3' : '$red3';
    case 'medium':
      return isLong ? '$green5' : '$red5';
    case 'dark':
      return isLong ? '$green7' : '$red7';
    default:
      return isLong ? '$green5' : '$red5';
  }
}
