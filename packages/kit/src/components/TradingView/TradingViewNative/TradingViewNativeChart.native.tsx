import { useCallback, useContext, useMemo, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ErrorBoundarySimple } from '../../ErrorBoundary';

import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';

import type { ITradingViewNativeChartProps } from './TradingViewNativeChart.types';
import type { LayoutChangeEvent } from 'react-native';

function TradingViewChartFallback({
  chartSettings,
  locale,
  onChartWidthChange,
  points,
  priceAxisDecimalPlaces,
  priceDecimalPlaces,
  testID,
}: ITradingViewNativeChartProps) {
  const [height, setHeight] = useState(0);
  const onChartReady = useContext(TradingViewNativeChartReadyContext);
  const data = useMemo(
    () => points.map(({ t, c }): [number, number] => [t, c]),
    [points],
  );
  const handleLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      setHeight(layout.height);
      onChartWidthChange?.(layout.width);
    },
    [onChartWidthChange],
  );
  const { LightweightChart } =
    require('../../LightweightChart/LightweightChart.catalyst') as typeof import('../../LightweightChart/LightweightChart.catalyst');

  // Reuse the live closing prices and keep the surrounding interval controls.
  return (
    <Stack flex={1} minHeight={0} testID={testID} onLayout={handleLayout}>
      {height > 0 ? (
        <LightweightChart
          data={data}
          height={height}
          locale={locale}
          onReady={onChartReady ?? undefined}
          seriesType="dotted-area"
          priceFormatterPrecision={priceAxisDecimalPlaces ?? priceDecimalPlaces}
          showLastValue={chartSettings.options.latestPrice}
          showPriceScale={chartSettings.options.yAxis}
          showTimeScale
        />
      ) : null}
    </Stack>
  );
}

function SkiaTradingViewChart(
  props: ITradingViewNativeChartProps & { onSkiaError: () => void },
) {
  // Keep module initialization inside the boundary for incompatible native builds.
  const { TradingViewNativeChart: Chart } =
    require('./native/TradingViewNativeChart') as typeof import('./native/TradingViewNativeChart');
  return <Chart {...props} />;
}

export function TradingViewNativeChart(props: ITradingViewNativeChartProps) {
  const [skiaFailed, setSkiaFailed] = useState(false);
  const handleSkiaError = useCallback(() => setSkiaFailed(true), []);
  const fallback = <TradingViewChartFallback {...props} />;

  if (platformEnv.isNativeIOSMacCatalyst || skiaFailed) {
    return fallback;
  }
  return (
    <ErrorBoundarySimple fallback={fallback}>
      <SkiaTradingViewChart {...props} onSkiaError={handleSkiaError} />
    </ErrorBoundarySimple>
  );
}
