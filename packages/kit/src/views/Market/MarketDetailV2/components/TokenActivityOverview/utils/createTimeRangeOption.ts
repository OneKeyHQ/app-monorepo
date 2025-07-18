import { clampPercentage } from '@onekeyhq/shared/src/utils/numberUtils';
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
  if (priceChangePercent && typeof priceChangePercent === 'string') {
    const formattedValue = clampPercentage(priceChangePercent);

    // Check if formatted value is zero (e.g., 0.001% becomes 0.00%)
    const isZero = formattedValue === 0;
    const isPositive = formattedValue > 0;

    // Format percentage with + sign for positive values
    let formattedPercentage = `${formattedValue.toFixed(2)}%`;
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
