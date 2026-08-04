import BigNumber from 'bignumber.js';

export const BORROW_EMPTY_STATE_ASSET_COUNT = 5;

type ISupplyAssetLike = {
  apyDetail?: { apy?: string };
  supplyButton?: { disabled?: boolean };
};

export function pickTopSupplyAssetsByApy<T extends ISupplyAssetLike>(
  assets: T[] | undefined,
  limit: number = BORROW_EMPTY_STATE_ASSET_COUNT,
): T[] {
  if (!assets?.length) {
    return [];
  }
  const apyOf = (asset: T) => {
    const value = new BigNumber(asset.apyDetail?.apy ?? '');
    return value.isFinite() ? value : new BigNumber(0);
  };
  return assets
    .filter((asset) => !asset.supplyButton?.disabled)
    .toSorted((a, b) => apyOf(b).comparedTo(apyOf(a)) ?? 0)
    .slice(0, limit);
}
