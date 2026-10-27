import BigNumber from 'bignumber.js';

import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
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
    const parsed = new BigNumber(priceChangePercent);
    // An unparseable payload reads as flat, the way it did before this went
    // through the shared formatter.
    const safeValue = parsed.isNaN() ? '0' : priceChangePercent;

    // Rounded first, so a value that only survives at more than two decimals
    // (0.001%) counts as zero for the color and the sign, matching what the
    // formatted string actually shows.
    const rounded = new BigNumber(safeValue).decimalPlaces(
      2,
      BigNumber.ROUND_HALF_UP,
    );
    const isZero = rounded.isZero();
    const isPositive = rounded.isGreaterThan(0);

    // The same formatter the list and detail percentages use, so this row
    // carries one ±99,999% ceiling with them instead of its own.
    // `showPlusMinusSigns` is dropped at zero to keep it a bare `0.00%`;
    // a negative value keeps its sign either way.
    const percentageChange = numberFormat(safeValue, {
      formatter: 'priceChangeCapped',
      formatterOptions: { showPlusMinusSigns: !isZero },
    });

    return {
      label,
      value,
      percentageChange,
      isPositive,
      isZero,
    };
  }
  return null;
}
