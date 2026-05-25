import BigNumber from 'bignumber.js';

export const UNAVAILABLE_DISPLAY = '--';

// Fields typed as `string`/`number` on ITokenFiat may arrive null/undefined
// when an upstream provider fails. Non-finite values (NaN, Infinity) and any
// non-parseable string must be rejected so downstream BigNumber math does not
// propagate NaN through aggregate sums.
export function isValidNumberValue(
  v: string | number | null | undefined,
): v is string | number {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return Number.isFinite(v);
  return new BigNumber(v).isFinite();
}

export function displayOrUnavailable(
  v: string | number | null | undefined,
): string | number {
  return isValidNumberValue(v) ? v : UNAVAILABLE_DISPLAY;
}

// For sort-partition placement: tokens with unavailable fiatValue sink to the
// bottom alongside zero-value tokens. `new BigNumber('NaN').isZero()` is
// false, so a raw BigNumber check would mis-classify unavailable rows.
export function isUnavailableOrZeroFiatValue(
  v: string | number | null | undefined,
): boolean {
  return !isValidNumberValue(v) || new BigNumber(v).isZero();
}

type ITokenFiatValueShape = {
  fiatValue?: string | null;
};

type IFiatValueIndexed = { $key: string };

// Sum tokens[i].$key → map[$key].fiatValue, silently dropping entries whose
// value is unavailable so the subtotal stays a partial sum rather than NaN.
export function sumFiatValuesFromTokens(
  tokens: IFiatValueIndexed[],
  map: Record<string, ITokenFiatValueShape | undefined> | undefined,
): BigNumber {
  if (!map) return new BigNumber(0);
  return tokens.reduce<BigNumber>((acc, token) => {
    const v = map[token.$key]?.fiatValue;
    return isValidNumberValue(v) ? acc.plus(v) : acc;
  }, new BigNumber(0));
}

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
// accountWorth write site. Single pass over both maps to avoid the
// toFixed → reparse round trip.
export function sumTokenGroupsFiatValueIgnoringUnavailable(r: {
  tokens?: { map?: Record<string, ITokenFiatValueShape | undefined> };
  smallBalanceTokens?: {
    map?: Record<string, ITokenFiatValueShape | undefined>;
  };
}): string {
  let acc = new BigNumber(0);
  const addAll = (
    map: Record<string, ITokenFiatValueShape | undefined> | undefined,
  ) => {
    if (!map) return;
    for (const entry of Object.values(map)) {
      if (entry && isValidNumberValue(entry.fiatValue)) {
        acc = acc.plus(entry.fiatValue);
      }
    }
  };
  addAll(r.tokens?.map);
  addAll(r.smallBalanceTokens?.map);
  return acc.toFixed();
}
