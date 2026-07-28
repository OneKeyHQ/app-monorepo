import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export function isTradingViewNativePriceUp(
  point: Pick<IMarketTokenKLineDataPoint, 'c' | 'o'>,
) {
  return point.c >= point.o;
}
