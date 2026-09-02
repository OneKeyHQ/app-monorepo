import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

export function buildMarketAssetTokenDetail({
  assetDetail,
  decimals,
  lastUpdated,
}: {
  assetDetail: IMarketAssetDetailData;
  decimals: number;
  lastUpdated: number;
}): IMarketTokenDetail {
  const { asset, market, performance, selectedVariant } = assetDetail;

  return {
    address: selectedVariant.tokenAddress,
    networkId: selectedVariant.networkId,
    isNative: selectedVariant.isNative,
    logoUrl: asset.logoUrl,
    name: asset.name,
    symbol: asset.symbol.toUpperCase(),
    decimals,
    price: market.price,
    priceChange24hPercent: market.priceChange24hPercent,
    priceChange7dPercent: performance.priceChange7dPercent,
    priceChange30dPercent: performance.priceChange30dPercent,
    priceChange3mPercent: performance.priceChange3mPercent,
    priceChange1yPercent: performance.priceChange1yPercent,
    marketCap: market.marketCap,
    fdv: market.fdv,
    circulatingSupply: market.circulatingSupply,
    volume24h: market.volume24h,
    lastUpdated,
  };
}
