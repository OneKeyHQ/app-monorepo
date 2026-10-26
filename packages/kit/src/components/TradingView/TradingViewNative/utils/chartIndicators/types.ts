import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type {
  ITradingViewNativeIndicatorLineStyle,
  ITradingViewNativeIndicatorSettingsItem,
} from '@onekeyhq/shared/types/tradingViewNative';

export const TRADING_VIEW_NATIVE_INDICATORS = [
  'MA',
  'EMA',
  'BOLL',
  'SAR',
] as const;

export type ITradingViewNativeIndicator =
  (typeof TRADING_VIEW_NATIVE_INDICATORS)[number];

export const DEFAULT_TRADING_VIEW_NATIVE_INDICATORS: readonly ITradingViewNativeIndicator[] =
  [];

export type ITradingViewNativeIndicatorPaint =
  | 'indicatorCyanStroke'
  | 'indicatorDarkOrangeStroke'
  | 'indicatorOrangeStroke'
  | 'indicatorPinkStroke'
  | 'indicatorSarPoint';

export interface ITradingViewNativeIndicatorSeries {
  fill?: {
    color: string;
    opacity: number;
    toSeriesKey: string;
  };
  indicator: ITradingViewNativeIndicator;
  key: string;
  kind: 'line' | 'points';
  legendLabel?: string;
  paint: ITradingViewNativeIndicatorPaint;
  style?: {
    color: string;
    lineStyle: ITradingViewNativeIndicatorLineStyle;
    lineWidth: number;
    opacity: number;
  };
  values: Array<number | null>;
  visible?: boolean;
}

export interface ITradingViewNativeIndicatorPriceRange {
  maxPrice: number;
  minPrice: number;
}

export type ITradingViewNativeIndicatorSeriesBuilder = (
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
) => ITradingViewNativeIndicatorSeries[];

export function isTradingViewNativeIndicator(
  value: string,
): value is ITradingViewNativeIndicator {
  return (TRADING_VIEW_NATIVE_INDICATORS as readonly string[]).includes(value);
}
