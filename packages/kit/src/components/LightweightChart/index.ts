import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const LightweightChart = platformEnv.isNativeIOSMacCatalyst
  ? (
      require('./LightweightChart.catalyst') as typeof import('./LightweightChart.catalyst')
    ).LightweightChart
  : (require('./LightweightChart') as typeof import('./LightweightChart'))
      .LightweightChart;
export type {
  ILightweightChartLineType,
  ILightweightChartPriceScalePosition,
  ILightweightChartProps,
} from './types';
export {
  APY_PRICE_SCALE_MARGINS,
  DEFAULT_CHART_COLORS,
} from './utils/constants';
