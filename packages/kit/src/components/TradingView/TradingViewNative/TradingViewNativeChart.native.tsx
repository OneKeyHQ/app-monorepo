import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ITradingViewNativeChartProps } from './TradingViewNativeChart.types';

type INativeChartModule = typeof import('./native/TradingViewNativeChart');

const NativeTradingViewNativeChart = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('./native/TradingViewNativeChart') as INativeChartModule)
      .TradingViewNativeChart;

export function TradingViewNativeChart(props: ITradingViewNativeChartProps) {
  if (!NativeTradingViewNativeChart) {
    return <Stack flex={1} testID={props.testID} />;
  }
  return <NativeTradingViewNativeChart {...props} />;
}
