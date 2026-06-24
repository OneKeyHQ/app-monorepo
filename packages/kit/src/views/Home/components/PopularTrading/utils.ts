import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  getNativeTokenInfo,
  normalizeStockMetadataValue,
} from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import type { IFavoriteTokenDisplay } from './types';

function getTokenKey(token: {
  chainId: string;
  contractAddress: string;
  perpsCoin?: string;
}) {
  if (token.perpsCoin) {
    return `perps:${token.perpsCoin}`;
  }
  return `${token.chainId}:${token.contractAddress}`;
}

const EMPTY_DISPLAY_TOKENS: IFavoriteTokenDisplay[] = [];

function parseMarketValue(value?: string | number | null) {
  const normalizedValue = normalizeStockMetadataValue(value);
  if (!normalizedValue) {
    return undefined;
  }

  const parsedValue = parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function getStockPreferredParsedMarketValue(
  stockValue?: string | number | null,
  fallbackValue?: string | number | null,
) {
  return parseMarketValue(stockValue) ?? parseMarketValue(fallbackValue) ?? 0;
}

function getMarketTokenDisplayMarketCap(item: IMarketTokenListItem) {
  return getStockPreferredParsedMarketValue(
    item.stock?.marketCap,
    item.marketCap,
  );
}

function getMarketTokenDisplayVolume24h(item: IMarketTokenListItem) {
  return getStockPreferredParsedMarketValue(
    item.stock?.assetAnalysis?.volume24h,
    item.volume24h,
  );
}

function getMarketTokenDisplayPrice(item: IMarketTokenListItem) {
  return parseMarketValue(item.price) ?? 0;
}

function getMarketTokenDisplayPriceChange24h(item: IMarketTokenListItem) {
  return parseMarketValue(item.priceChange24hPercent) ?? 0;
}

function mapMarketTokenToDisplay(
  item: IMarketTokenListItem,
): IFavoriteTokenDisplay | null {
  const chainId = item.networkId ?? item.chainId ?? '';
  if (!chainId) {
    return null;
  }

  const { isNative } = getNativeTokenInfo(item.isNative, item.address);

  return {
    chainId,
    contractAddress: isNative ? '' : (item.address ?? ''),
    isNative,
    symbol: item.symbol,
    name: item.name,
    logoUrl: item.logoUrl ?? '',
    logoUrls: item.logoUrls,
    price: getMarketTokenDisplayPrice(item),
    priceChange24h: getMarketTokenDisplayPriceChange24h(item),
    marketCap: getMarketTokenDisplayMarketCap(item),
    volume24h: getMarketTokenDisplayVolume24h(item),
    communityRecognized: item.communityRecognized,
    stock: item.stock,
  };
}

export {
  EMPTY_DISPLAY_TOKENS,
  getMarketTokenDisplayMarketCap,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
  mapMarketTokenToDisplay,
};
