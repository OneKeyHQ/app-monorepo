import {
  parseAprPercentValue,
  parseFormattedLiquidityValue,
} from './availableAssetsUtils';

export const EARN_MOBILE_RECOMMENDED_ASSET_COUNT = 5;

type IRecommendedAssetLike = {
  aprWithoutFee?: string;
  available?: { text?: string };
};

export function pickMobileRecommendedAssets<T extends IRecommendedAssetLike>(
  assets: T[],
  limit: number = EARN_MOBILE_RECOMMENDED_ASSET_COUNT,
) {
  return assets
    .toSorted((assetA, assetB) => {
      const balanceA = parseFormattedLiquidityValue(assetA.available?.text);
      const balanceB = parseFormattedLiquidityValue(assetB.available?.text);
      const hasBalanceA = balanceA > 0;
      const hasBalanceB = balanceB > 0;

      if (hasBalanceA !== hasBalanceB) {
        return hasBalanceA ? -1 : 1;
      }
      if (hasBalanceA && balanceA !== balanceB) {
        return balanceB - balanceA;
      }
      return (
        parseAprPercentValue(assetB.aprWithoutFee) -
        parseAprPercentValue(assetA.aprWithoutFee)
      );
    })
    .slice(0, limit);
}
