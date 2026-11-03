import {
  EMarketBannerType,
  type IMarketBannerTokenPreview,
} from '@onekeyhq/shared/types/marketV2';

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

// Banners whose non-perps list comes from the stock endpoint. `mixed` is the
// legacy spelling of `stock_perps`.
export function isMarketStockPerpsBanner(type?: EMarketBannerType): boolean {
  return (
    type === EMarketBannerType.StockPerps || type === EMarketBannerType.Mixed
  );
}

// Banners that carry a perps list beside their spot list, so the detail page
// shows the two as tabs.
export function isMarketMixedBanner(type?: EMarketBannerType): boolean {
  return (
    isMarketStockPerpsBanner(type) || type === EMarketBannerType.TickerPerps
  );
}

export function getMarketBannerTopTokens(
  tokens: IMarketBannerTokenPreview[] = [],
) {
  return tokens
    .toSorted((left, right) => {
      const leftChange = Number(
        left.priceChange24hPercent?.trim() || Number.NaN,
      );
      const rightChange = Number(
        right.priceChange24hPercent?.trim() || Number.NaN,
      );
      if (!Number.isFinite(leftChange))
        return Number.isFinite(rightChange) ? 1 : 0;
      if (!Number.isFinite(rightChange)) return -1;
      return rightChange - leftChange;
    })
    .slice(0, 3);
}
