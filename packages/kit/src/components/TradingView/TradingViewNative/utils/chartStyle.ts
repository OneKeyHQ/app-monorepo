import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

export function isTradingViewNativePriceUp(
  point: Pick<IMarketTokenKLineDataPoint, 'c' | 'o'>,
) {
  'worklet';

  return point.c >= point.o;
}
