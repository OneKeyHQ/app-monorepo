import type {
  IMarketPerpsTokenFromServer,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

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

function getMarketCategoryTokensRequestKey({
  minLiquidity,
  selectedMarketCategoryId,
}: {
  minLiquidity: number;
  selectedMarketCategoryId?: string;
}) {
  return `${selectedMarketCategoryId ?? ''}:${minLiquidity}`;
}

function createHomeMarketCategoryTokensCache<T>() {
  let nextRequestId = 0;
  const latestRequestIdByKey: Record<string, number> = {};
  let tokensByRequestKey: Record<string, T[]> = {};

  return {
    beginRequest({
      categoryIds,
      minLiquidity,
    }: {
      categoryIds: string[];
      minLiquidity: number;
    }) {
      nextRequestId += 1;
      categoryIds.forEach((categoryId) => {
        latestRequestIdByKey[
          getMarketCategoryTokensRequestKey({
            minLiquidity,
            selectedMarketCategoryId: categoryId,
          })
        ] = nextRequestId;
      });
      return nextRequestId;
    },
    commitCategory({
      categoryId,
      minLiquidity,
      requestId,
      tokens,
    }: {
      categoryId: string;
      minLiquidity: number;
      requestId: number;
      tokens: T[];
    }) {
      const requestKey = getMarketCategoryTokensRequestKey({
        minLiquidity,
        selectedMarketCategoryId: categoryId,
      });
      if (latestRequestIdByKey[requestKey] !== requestId) {
        return false;
      }

      tokensByRequestKey = {
        ...tokensByRequestKey,
        [requestKey]: tokens,
      };
      return true;
    },
    getSnapshot() {
      return tokensByRequestKey;
    },
    getTokens({
      minLiquidity,
      selectedMarketCategoryId,
    }: {
      minLiquidity: number;
      selectedMarketCategoryId?: string;
    }) {
      return tokensByRequestKey[
        getMarketCategoryTokensRequestKey({
          minLiquidity,
          selectedMarketCategoryId,
        })
      ];
    },
  };
}

function getMarketCategoryIds({
  prefetchMarketCategoryIds,
  selectedMarketCategoryId,
}: {
  prefetchMarketCategoryIds?: string[];
  selectedMarketCategoryId?: string;
}) {
  return Array.from(
    new Set(
      [...(prefetchMarketCategoryIds ?? []), selectedMarketCategoryId].filter(
        (categoryId): categoryId is string => Boolean(categoryId),
      ),
    ),
  ).toSorted();
}

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

export {
  EMPTY_DISPLAY_TOKENS,
  createHomeMarketCategoryTokensCache,
  getMarketCategoryIds,
  getMarketCategoryTokensRequestKey,
  getMarketTokenDisplayMarketCap,
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  getTokenKey,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
};
