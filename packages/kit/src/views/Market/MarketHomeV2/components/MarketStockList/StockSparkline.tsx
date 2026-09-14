import { memo, useMemo } from 'react';

import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import SparklineChart, {
  MARKET_SPARKLINE_COLORS,
} from '../../../components/SparklineChart';

import { downsampleStockSparkline } from './utils';

const SPARKLINE_WIDTH = 132;
const SPARKLINE_HEIGHT = 44;

function StockSparklineImpl({
  data,
  priceChange24hPercent,
}: {
  data?: number[];
  priceChange24hPercent?: string;
}) {
  const themeVariant = useThemeVariant();
  const sampledData = useMemo(
    () => downsampleStockSparkline(data ?? []),
    [data],
  );

  if (sampledData.length < 2) {
    return null;
  }

  const themeColors =
    MARKET_SPARKLINE_COLORS[themeVariant === 'dark' ? 'dark' : 'light'];
  const [lineColor, gradientColor] =
    Number(priceChange24hPercent) < 0
      ? themeColors.negative
      : themeColors.positive;

  return (
    <SparklineChart
      data={sampledData}
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      lineColor={lineColor}
      linearGradientColor={gradientColor}
    />
  );
}

export const StockSparkline = memo(StockSparklineImpl);
