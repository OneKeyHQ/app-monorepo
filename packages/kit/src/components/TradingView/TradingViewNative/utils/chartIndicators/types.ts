import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

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
  indicator: ITradingViewNativeIndicator;
  key: string;
  kind: 'line' | 'points';
  paint: ITradingViewNativeIndicatorPaint;
  values: Array<number | null>;
}

export interface ITradingViewNativeIndicatorPriceRange {
  maxPrice: number;
  minPrice: number;
}

export type ITradingViewNativeIndicatorSeriesBuilder = (
  points: readonly IMarketTokenKLineDataPoint[],
) => ITradingViewNativeIndicatorSeries[];

export function isTradingViewNativeIndicator(
  value: string,
): value is ITradingViewNativeIndicator {
  return (TRADING_VIEW_NATIVE_INDICATORS as readonly string[]).includes(value);
}
