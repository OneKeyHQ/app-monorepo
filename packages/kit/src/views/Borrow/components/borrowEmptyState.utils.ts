import BigNumber from 'bignumber.js';

export const BORROW_EMPTY_STATE_ASSET_COUNT = 5;

type ISupplyAssetLike = {
  walletBalance?: { fiatValue?: string };
  supplyButton?: { disabled?: boolean };
};

/**
 * Leads the empty state with what the user already holds, largest first, the
 * way the desktop "Assets to supply" table is sorted. Fiat value is what makes
 * two different tokens comparable at all.
 *
 * The sort being stable is load-bearing rather than incidental: every asset the
 * user holds none of ties at zero, so that whole tail keeps the order the
 * server sent, which is the ranking this list falls back to.
 */
export function pickTopSupplyAssetsByBalance<T extends ISupplyAssetLike>(
  assets: T[] | undefined,
  limit: number = BORROW_EMPTY_STATE_ASSET_COUNT,
): T[] {
  if (!assets?.length) {
    return [];
  }
  const fiatValueOf = (asset: T) => {
    const value = new BigNumber(asset.walletBalance?.fiatValue ?? '');
    return value.isFinite() ? value : new BigNumber(0);
  };
  return assets
    .filter((asset) => !asset.supplyButton?.disabled)
    .toSorted((a, b) => fiatValueOf(b).comparedTo(fiatValueOf(a)) ?? 0)
    .slice(0, limit);
}
