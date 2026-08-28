import { memo, useMemo } from 'react';

import Svg, {
  Defs,
  LinearGradient,
  Polygon,
  Polyline,
  Stop,
} from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

import { buildStockSparklinePoints } from './utils';

const SPARKLINE_WIDTH = 132;
const SPARKLINE_HEIGHT = 44;

// Top coins fills its sparkline with the line color at 20% opacity fading to
// transparent (see TOP_COINS_SPARKLINE_COLORS in MarketTopCoinsList). That list
// draws on a canvas and hardcodes its rgba stops; this one is SVG, so the same
// treatment is expressed as gradient stops over the themed line color.
const SPARKLINE_FILL_TOP_OPACITY = 0.2;
const SPARKLINE_FILL_BOTTOM_OPACITY = 0;

function StockSparklineImpl({
  data,
  priceChange24hPercent,
}: {
  data?: number[];
  priceChange24hPercent?: string;
}) {
  const theme = useTheme();
  const points = useMemo(
    () =>
      buildStockSparklinePoints({
        data: data ?? [],
        width: SPARKLINE_WIDTH,
        height: SPARKLINE_HEIGHT,
      }),
    [data],
  );

  if (!points) {
    return null;
  }

  const priceChange = Number(priceChange24hPercent);
  const isNegative = Number.isFinite(priceChange) && priceChange < 0;
  const lineColor = isNegative ? theme.textCritical.val : theme.textSuccess.val;
  // One gradient id per direction, so a row switching sign cannot keep painting
  // the previous fill from a stale definition.
  const gradientId = `stock-sparkline-${isNegative ? 'down' : 'up'}`;
  // Close the line down to the baseline to get the filled area.
  const areaPoints = `${points} ${SPARKLINE_WIDTH},${SPARKLINE_HEIGHT} 0,${SPARKLINE_HEIGHT}`;

  return (
    <Svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0"
            stopColor={lineColor}
            stopOpacity={SPARKLINE_FILL_TOP_OPACITY}
          />
          <Stop
            offset="1"
            stopColor={lineColor}
            stopOpacity={SPARKLINE_FILL_BOTTOM_OPACITY}
          />
        </LinearGradient>
      </Defs>
      <Polygon points={areaPoints} fill={`url(#${gradientId})`} stroke="none" />
      <Polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const StockSparkline = memo(StockSparklineImpl);
