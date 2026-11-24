import { useCallback, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ChartUnavailable } from '../ChartUnavailable';
import { ErrorBoundarySimple } from '../ErrorBoundary';

import type { ILightweightChartProps } from './types';

function NativeChart({
  onSkiaError,
  ...props
}: ILightweightChartProps & { onSkiaError: () => void }) {
  if (platformEnv.isNativeIOSMacCatalyst) {
    const { LightweightChart: CatalystChart } =
      require('./LightweightChart.catalyst') as typeof import('./LightweightChart.catalyst');
    return <CatalystChart {...props} />;
  }

  const { loadResult } =
    require('./loadSkiaChart.native') as typeof import('./loadSkiaChart.native');
  if ('error' in loadResult) throw loadResult.error;
  const { chart: Chart } = loadResult;
  return <Chart {...props} onSkiaError={onSkiaError} />;
}

export function LightweightChart(props: ILightweightChartProps) {
  const [skiaFailed, setSkiaFailed] = useState(false);
  const handleSkiaError = useCallback(() => setSkiaFailed(true), []);
  const fallback = <ChartUnavailable height={props.height} />;

  if (skiaFailed) {
    return fallback;
  }

  return (
    <ErrorBoundarySimple fallback={fallback}>
      <NativeChart {...props} onSkiaError={handleSkiaError} />
    </ErrorBoundarySimple>
  );
}
