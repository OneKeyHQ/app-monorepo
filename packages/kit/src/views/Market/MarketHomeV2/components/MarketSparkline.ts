import { useMemo } from 'react';

import { useTheme } from '@onekeyhq/components';

export const MARKET_SPARKLINE_WIDTH = 132;
export const MARKET_SPARKLINE_HEIGHT = 44;

// The fill starts at this alpha under the line and fades out to transparent.
const SPARKLINE_GRADIENT_ALPHA = 0.2;

// The canvas gradient takes a concrete color string, so the resolved theme
// token is re-expressed here with the fill's own alpha in place of the token's.
function toGradientColor(color: string): string {
  const hex = color.replace('#', '');
  const rgb =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : hex.slice(0, 6);
  const channels = [
    Number.parseInt(rgb.slice(0, 2), 16),
    Number.parseInt(rgb.slice(2, 4), 16),
    Number.parseInt(rgb.slice(4, 6), 16),
  ];
  if (channels.some((channel) => !Number.isFinite(channel))) {
    return color;
  }
  return `rgba(${channels.join(', ')}, ${SPARKLINE_GRADIENT_ALPHA})`;
}

export function useMarketSparklineColors() {
  const theme = useTheme();
  const positiveColor = theme.textSuccess.val;
  const negativeColor = theme.textCritical.val;
  return useMemo(
    () => ({
      positive: [positiveColor, toGradientColor(positiveColor)] as const,
      negative: [negativeColor, toGradientColor(negativeColor)] as const,
    }),
    [positiveColor, negativeColor],
  );
}
