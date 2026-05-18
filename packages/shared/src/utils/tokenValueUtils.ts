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
  balanceParsed?: string | null;
};

export function tokenMapHasUnavailable(
  map: Record<string, ITokenFiatValueShape | undefined> | undefined,
): boolean {
  if (!map) return false;
  return Object.values(map).some(
    (entry) =>
      !!entry &&
      (!isValidNumberValue(entry.fiatValue) ||
        !isValidNumberValue(entry.balanceParsed)),
  );
}

// Convenience for the common per-network shape produced by token list
// fetches — collapses the duplicated `tokens.map || smallBalanceTokens.map`
// check at every accountWorth source site.
export function tokenGroupsHaveUnavailable(r: {
  tokens?: { map?: Record<string, ITokenFiatValueShape | undefined> };
  smallBalanceTokens?: {
    map?: Record<string, ITokenFiatValueShape | undefined>;
  };
}): boolean {
  return (
    tokenMapHasUnavailable(r.tokens?.map) ||
    tokenMapHasUnavailable(r.smallBalanceTokens?.map)
  );
}
