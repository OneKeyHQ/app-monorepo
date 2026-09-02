import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigHomeTab,
  IMarketPerpsTokenFromServer,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

import {
  getNativeTokenInfo,
  normalizeStockMetadataValue,
} from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { ensureMarketTopCoinsCategory } from '../../../Market/MarketHomeV2/utils';

import { HOME_WATCHLIST_TAB_TYPE } from './constants';

import type { IFavoriteTokenDisplay } from './types';
import type { IMarketCategoryItem } from '../../../Market/MarketHomeV2/types';

function getTokenKey(token: {
  chainId: string;
  contractAddress: string;
  perpsCoin?: string;
  marketAsset?: Pick<IMarketAssetListItem, 'assetId'>;
}) {
  if (token.marketAsset) {
    return `market:${token.marketAsset.assetId}`;
  }
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

function mapMarketPerpsTokenToDisplay({
  token,
  subtitle,
}: {
  token: IMarketPerpsTokenFromServer;
  subtitle?: string;
}): IFavoriteTokenDisplay {
  return {
    chainId: '',
    contractAddress: '',
    isNative: false,
    symbol: token.displayName,
    name: token.displayName,
    logoUrl: token.tokenImageUrl ?? '',
    price: parseMarketValue(token.markPrice) ?? 0,
    priceChange24h: parseMarketValue(token.change24hPercent) ?? 0,
    marketCap: 0,
    volume24h: parseMarketValue(token.volume24h) ?? 0,
    perpsCoin: token.name,
    perpsSubtitle: subtitle,
    maxLeverage: token.maxLeverage,
  };
}

function mapMarketAssetToDisplay(
  item: IMarketAssetListItem,
): IFavoriteTokenDisplay {
  return {
    chainId: '',
    contractAddress: '',
    isNative: false,
    symbol: item.symbol.toUpperCase(),
    name: item.symbol,
    logoUrl: item.logoUrl,
    price: parseMarketValue(item.price) ?? 0,
    priceChange24h: parseMarketValue(item.priceChange24hPercent) ?? 0,
    marketCap: parseMarketValue(item.marketCap) ?? 0,
    volume24h: parseMarketValue(item.volume24h) ?? 0,
    marketAsset: item,
  };
}

function buildHomeMarketCategories({
  apiHomeTabs,
  favoritesCategory,
  marketCategories,
  homePerpsHotCategory,
  topCoinsFallbackName,
}: {
  apiHomeTabs: IMarketBasicConfigHomeTab[];
  favoritesCategory: IMarketCategoryItem;
  marketCategories: IMarketCategoryItem[];
  homePerpsHotCategory?: IMarketCategoryItem;
  topCoinsFallbackName: string;
}) {
  const categories =
    apiHomeTabs.length > 0
      ? apiHomeTabs.map((tab) => {
          if (tab.type === HOME_WATCHLIST_TAB_TYPE) {
            return {
              ...favoritesCategory,
              name: tab.name,
            };
          }

          return {
            id: tab.type,
            name: tab.name,
            icon: tab.icon,
          };
        })
      : [favoritesCategory, ...marketCategories];
  const categoriesWithTopCoins = ensureMarketTopCoinsCategory(
    categories,
    topCoinsFallbackName,
  );

  return homePerpsHotCategory
    ? [...categoriesWithTopCoins, homePerpsHotCategory]
    : categoriesWithTopCoins;
}

export {
  EMPTY_DISPLAY_TOKENS,
  buildHomeMarketCategories,
  getMarketTokenDisplayMarketCap,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
  mapMarketAssetToDisplay,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
};
