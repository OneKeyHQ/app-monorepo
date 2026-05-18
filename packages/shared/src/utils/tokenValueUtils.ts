import BigNumber from 'bignumber.js';

export const UNAVAILABLE_DISPLAY = '--';

// Why loose runtime type: during the OK-46226 backend compatibility window,
// fields typed as `string`/`number` on ITokenFiat may arrive as null/undefined
// when an upstream provider (indexer/onchain/wallet) fails to return data.
// NaN/'NaN' must also be rejected because downstream BigNumber math would
// otherwise propagate NaN through aggregate sums.
export function isValidNumberValue(
  v: string | number | null | undefined,
): v is string | number {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v);
  return v !== 'NaN';
}

export function displayOrUnavailable(
  v: string | number | null | undefined,
): string | number {
  return isValidNumberValue(v) ? v : UNAVAILABLE_DISPLAY;
}

type ITokenFiatValueShape = {
  fiatValue?: string | null;
};

// Sum map.fiatValue while silently dropping entries whose value is unavailable
// (null/undefined/''/NaN). Mirrors the partial-sum semantics already used in
// All Networks aggregation so a single broken upstream provider does not
// poison the per-network total with NaN or force the whole sum to '--'.
export function sumFiatValuesIgnoringUnavailable(
  map: Record<string, ITokenFiatValueShape | undefined> | undefined,
): string {
  if (!map) return '0';
  return Object.values(map)
    .reduce<BigNumber>((acc, entry) => {
      if (!entry || !isValidNumberValue(entry.fiatValue)) return acc;
      return acc.plus(entry.fiatValue);
    }, new BigNumber(0))
    .toFixed();
}

// Convenience for the per-network shape produced by token list fetches:
// collapses the duplicated `tokens.map + smallBalanceTokens.map` sum at every
// accountWorth write site.
export function sumTokenGroupsFiatValueIgnoringUnavailable(r: {
  tokens?: { map?: Record<string, ITokenFiatValueShape | undefined> };
  smallBalanceTokens?: {
    map?: Record<string, ITokenFiatValueShape | undefined>;
  };
}): string {
  return new BigNumber(sumFiatValuesIgnoringUnavailable(r.tokens?.map))
    .plus(sumFiatValuesIgnoringUnavailable(r.smallBalanceTokens?.map))
    .toFixed();
}
