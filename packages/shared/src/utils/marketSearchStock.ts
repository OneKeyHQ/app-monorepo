import type { IMarketSearchV2Token } from '../../types/market';
import type { IMarketStockPublicItem } from '../../types/marketV2';

export function isMarketSearchStockListing(
  token: Pick<IMarketSearchV2Token, 'stockId' | 'address' | 'network'>,
) {
  return (
    Boolean(token.stockId?.trim()) &&
    !token.network?.trim() &&
    !token.address?.trim()
  );
}

export function mapMarketStockPublicItemToSearchToken(
  item: IMarketStockPublicItem,
): IMarketSearchV2Token {
  return {
    stockId: item.stockId,
    name: item.name,
    symbol: item.symbol,
    price: item.price ?? '0',
    address: '',
    network: '',
    logoUrl: item.logoUrl ?? '',
    isNative: false,
    decimals: 0,
    liquidity: '0',
    volume_24h: item.volume24h ?? '0',
    volume24h: item.volume24h,
    marketCap: item.marketCap,
    priceChange24hPercent: item.priceChange24hPercent,
    stock: {
      stockId: item.stockId,
      subtitle: item.name,
      sourceLogoUri: '',
    },
  };
}
