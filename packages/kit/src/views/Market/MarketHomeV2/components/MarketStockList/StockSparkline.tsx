import { memo } from 'react';

import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import SparklineChart from '../../../components/SparklineChart';

import {
  MARKET_SPARKLINE_COLORS,
  MARKET_SPARKLINE_HEIGHT,
  MARKET_SPARKLINE_WIDTH,
} from '../MarketSparkline';

function StockSparklineImpl({
  data,
  priceChange24hPercent,
}: {
  data?: number[];
  priceChange24hPercent?: string;
}) {
  const themeVariant = useThemeVariant();
  if (!data || data.filter(Number.isFinite).length < 2) {
    return null;
  }

  const priceChange = Number(priceChange24hPercent);
  const isNegative = Number.isFinite(priceChange) && priceChange < 0;
  const themeColors =
    MARKET_SPARKLINE_COLORS[themeVariant === 'dark' ? 'dark' : 'light'];
  const [lineColor, gradientColor] = isNegative
    ? themeColors.negative
    : themeColors.positive;

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
