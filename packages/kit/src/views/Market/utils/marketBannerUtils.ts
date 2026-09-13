import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

export function isMarketIndexQuoteBanner({
  type,
  assetType,
  indices,
}: {
  type?: EMarketBannerType;
  assetType?: string;
  indices?: readonly unknown[];
}): boolean {
  return (
    type === EMarketBannerType.Index ||
    type === EMarketBannerType.StockIndex ||
    (type === undefined && assetType === undefined && Boolean(indices?.length))
  );
}

export function isMarketMixedBanner(type?: EMarketBannerType): boolean {
  return (
    type === EMarketBannerType.StockPerps || type === EMarketBannerType.Mixed
  );
}
