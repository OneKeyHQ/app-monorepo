import { useCallback, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ChartUnavailable } from '../ChartUnavailable';
import { ErrorBoundarySimple } from '../ErrorBoundary';

import type { ILightweightChartProps } from './types';

function SkiaChart(
  props: ILightweightChartProps & { onSkiaError: () => void },
) {
  const { loadResult } =
    require('./loadSkiaChart.native') as typeof import('./loadSkiaChart.native');
  if ('error' in loadResult) throw loadResult.error;
  const { chart: Chart } = loadResult;
  return <Chart {...props} />;
}

export function LightweightChart(props: ILightweightChartProps) {
  const [skiaFailed, setSkiaFailed] = useState(false);
  const handleSkiaError = useCallback(() => setSkiaFailed(true), []);
  const fallback = <ChartUnavailable height={props.height} />;

  // Catalyst cannot load the native Skia module.
  if (platformEnv.isNativeIOSMacCatalyst || skiaFailed) {
    return fallback;
  }

  return (
    <ErrorBoundarySimple fallback={fallback}>
      <SkiaChart {...props} onSkiaError={handleSkiaError} />
    </ErrorBoundarySimple>
  );
}
