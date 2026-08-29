import { memo } from 'react';

import SparklineChart from '../../../components/SparklineChart';
import {
  MARKET_SPARKLINE_HEIGHT,
  MARKET_SPARKLINE_WIDTH,
  useMarketSparklineColors,
} from '../MarketSparkline';

function StockSparklineImpl({
  data,
  priceChange24hPercent,
}: {
  data?: number[];
  priceChange24hPercent?: string;
}) {
  const sparklineColors = useMarketSparklineColors();
  if (!data || data.filter(Number.isFinite).length < 2) {
    return null;
  }

  const priceChange = Number(priceChange24hPercent);
  const isNegative = Number.isFinite(priceChange) && priceChange < 0;
  const [lineColor, gradientColor] = isNegative
    ? sparklineColors.negative
    : sparklineColors.positive;

  return (
    <SparklineChart
      data={data.slice(-24)}
      width={MARKET_SPARKLINE_WIDTH}
      height={MARKET_SPARKLINE_HEIGHT}
      lineColor={lineColor}
      linearGradientColor={gradientColor}
    />
  );
}

export const StockSparkline = memo(StockSparklineImpl);
