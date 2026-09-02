import { memo, useMemo } from 'react';

import Svg, { Polyline } from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

import { buildStockSparklinePoints } from './utils';

const SPARKLINE_WIDTH = 132;
const SPARKLINE_HEIGHT = 44;

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
  const lineColor =
    Number.isFinite(priceChange) && priceChange < 0
      ? theme.textCritical.val
      : theme.textSuccess.val;

  return (
    <Svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT}>
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
