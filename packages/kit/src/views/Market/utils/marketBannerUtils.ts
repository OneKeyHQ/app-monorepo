import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

export function isMarketIndexQuoteBanner({
  type,
  assetType,
  title,
}: {
  type?: EMarketBannerType;
  assetType?: string;
  title?: string;
}) {
  return (
    type === EMarketBannerType.Index ||
    type === EMarketBannerType.StockIndex ||
    (type === undefined && assetType === undefined && title?.includes('指数'))
  );
}
