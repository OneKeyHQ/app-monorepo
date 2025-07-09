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
    const isZero = percentage === 0;
    const isPositive = percentage > 0;

    // Format percentage with + sign for positive values
    let formattedPercentage = `${percentage.toFixed(2)}%`;
    if (isPositive) {
      formattedPercentage = `+${formattedPercentage}`;
    }

    return {
      label,
      value,
      percentageChange: formattedPercentage,
      isPositive,
      isZero,
    };
  }
  return null;
}
