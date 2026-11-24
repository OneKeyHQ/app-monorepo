import { useCallback, useContext, useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ChartUnavailable } from '../../ChartUnavailable';
import { ErrorBoundarySimple } from '../../ErrorBoundary';

import { TradingViewNativeChartReadyContext } from './TradingViewNativeChartReadyContext';

import type { ITradingViewNativeChartProps } from './TradingViewNativeChart.types';

function TradingViewChartFallback({
  onChartUnavailable,
  testID,
}: Pick<ITradingViewNativeChartProps, 'onChartUnavailable' | 'testID'>) {
  const onChartReady = useContext(TradingViewNativeChartReadyContext);
  useEffect(() => {
    onChartUnavailable?.();
    // Fullscreen presentation can reveal the text once it is mounted.
    onChartReady?.();
  }, [onChartReady, onChartUnavailable]);

  return <ChartUnavailable testID={testID} />;
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
  const fallback = (
    <TradingViewChartFallback
      testID={props.testID}
      onChartUnavailable={props.onChartUnavailable}
    />
  );

  if (platformEnv.isNativeIOSMacCatalyst || skiaFailed) {
    return fallback;
  }
  return (
    <ErrorBoundarySimple fallback={fallback}>
      <SkiaTradingViewChart {...props} onSkiaError={handleSkiaError} />
    </ErrorBoundarySimple>
  );
}
