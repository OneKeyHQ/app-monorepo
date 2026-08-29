export const MARKET_SPARKLINE_WIDTH = 132;
export const MARKET_SPARKLINE_HEIGHT = 44;

export const MARKET_SPARKLINE_COLORS = {
  dark: {
    positive: ['rgba(70, 254, 165, 1)', 'rgba(70, 254, 165, 0.2)'],
    negative: ['rgba(255, 149, 146, 1)', 'rgba(255, 149, 146, 0.2)'],
  },
  light: {
    positive: ['rgba(0, 113, 63, 1)', 'rgba(0, 113, 63, 0.2)'],
    negative: ['rgba(196, 0, 6, 1)', 'rgba(196, 0, 6, 0.2)'],
  },
} as const;
