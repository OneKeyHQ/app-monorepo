import { Platform } from 'react-native';

import { Stack } from '@onekeyhq/components';

import type { ITradingViewNativeChartProps } from './TradingViewNativeChart.types';

type INativeChartModule = typeof import('./native/TradingViewNativeChart');

const NativeTradingViewNativeChart =
  Platform.OS === 'ios' && Platform.isMacCatalyst
    ? undefined
    : (require('./native/TradingViewNativeChart') as INativeChartModule)
        .TradingViewNativeChart;

export function TradingViewNativeChart(props: ITradingViewNativeChartProps) {
  if (!NativeTradingViewNativeChart) {
    return <Stack flex={1} testID={props.testID} />;
  }
  return <NativeTradingViewNativeChart {...props} />;
}
