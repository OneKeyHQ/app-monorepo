import { useCallback, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ErrorBoundarySimple } from '../ErrorBoundary';

import type { ILightweightChartProps } from './types';

function WebViewChart(props: ILightweightChartProps) {
  const { LightweightChart: Chart } =
    require('./LightweightChart.catalyst') as typeof import('./LightweightChart.catalyst');
  return <Chart {...props} />;
}

function SkiaChart(
  props: ILightweightChartProps & { onSkiaError: () => void },
) {
  // Keep module initialization inside the boundary for incompatible native builds.
  const { LightweightChart: Chart } =
    require('./LightweightChart.native') as typeof import('./LightweightChart.native');
  return <Chart {...props} />;
}

export function LightweightChart(props: ILightweightChartProps) {
  const [skiaFailed, setSkiaFailed] = useState(false);
  const handleSkiaError = useCallback(() => setSkiaFailed(true), []);
  const fallback = <WebViewChart {...props} />;

  // The Canvas 2D WebView keeps the series, range and hover callbacks.
  if (platformEnv.isNativeIOSMacCatalyst || skiaFailed) {
    return fallback;
  }

  return (
    <ErrorBoundarySimple fallback={fallback}>
      <SkiaChart {...props} onSkiaError={handleSkiaError} />
    </ErrorBoundarySimple>
  );
}
