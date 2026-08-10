import BigNumber from 'bignumber.js';

type ISupplyAssetLike = {
  supplyButton?: { disabled?: boolean };
  walletBalance?: { fiatValue?: string };
};

export function getBorrowRecommendationAssets<T extends ISupplyAssetLike>(
  assets: T[] | undefined,
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
    .toSorted((a, b) => fiatValueOf(b).comparedTo(fiatValueOf(a)) ?? 0);
}
