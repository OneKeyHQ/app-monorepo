import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

export type IPriceChangeKey =
  | 'priceChange1hPercent'
  | 'priceChange4hPercent'
  | 'priceChange8hPercent'
  | 'priceChange24hPercent';

export function createTimeRangeOption(
  tokenDetail: IMarketTokenDetail | undefined,
  priceChangeKey: IPriceChangeKey,
  label: string,
  value: string,
) {
  const priceChangePercent = tokenDetail?.[priceChangeKey];
  if (priceChangePercent) {
    const percentage = parseFloat(priceChangePercent);
    return {
      label,
      value,
      percentageChange: `${percentage.toFixed(2)}%`,
      isPositive: percentage > 0,
    };
  }
  return null;
}
