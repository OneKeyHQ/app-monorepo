import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import {
  getNativeTokenInfo,
  getStockMarketCapValue,
  getStockPeRatioValue,
  getStockVolume24hValue,
  normalizeStockMetadataValue,
  shouldUseStockMetadataColumnsForTokens,
} from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import type { IFavoriteTokenDisplay } from './types';

const EMPTY_MARKET_VALUE = '--';

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

function getDefaultMarketValue(value?: number) {
  return value ? value : EMPTY_MARKET_VALUE;
}

function getVolume24hValue(
  record: IFavoriteTokenDisplay,
  useStockMetadataColumns?: boolean,
) {
  return useStockMetadataColumns
    ? (getStockVolume24hValue(record) ??
        getDefaultMarketValue(record.volume24h))
    : getDefaultMarketValue(record.volume24h);
}

function getMarketCapValue(
  record: IFavoriteTokenDisplay,
  useStockMetadataColumns?: boolean,
) {
  return useStockMetadataColumns
    ? (getStockMarketCapValue(record) ??
        getDefaultMarketValue(record.marketCap))
    : getDefaultMarketValue(record.marketCap);
}

function getPeRatioValue(record: IFavoriteTokenDisplay) {
  return getStockPeRatioValue(record) ?? EMPTY_MARKET_VALUE;
}

function parseMarketValue(value?: string | number | null) {
  const normalizedValue = normalizeStockMetadataValue(value);
  if (!normalizedValue) {
    return undefined;
  }

  const parsedValue = parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function getMarketTokenDisplayMarketCap(item: IMarketTokenListItem) {
  return (
    parseMarketValue(item.stock?.marketCap) ??
    parseMarketValue(item.marketCap) ??
    0
  );
}

function getMarketTokenDisplayVolume24h(item: IMarketTokenListItem) {
  return (
    parseMarketValue(item.stock?.assetAnalysis?.volume24h) ??
    parseMarketValue(item.volume24h) ??
    0
  );
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
    price: parseFloat(item.price ?? '0'),
    priceChange24h: parseFloat(item.priceChange24hPercent ?? '0'),
    marketCap: getMarketTokenDisplayMarketCap(item),
    volume24h: getMarketTokenDisplayVolume24h(item),
    stock: item.stock,
  };
}

export {
  EMPTY_DISPLAY_TOKENS,
  EMPTY_MARKET_VALUE,
  getMarketCapValue,
  getMarketTokenDisplayMarketCap,
  getMarketTokenDisplayVolume24h,
  getPeRatioValue,
  getTokenKey,
  getVolume24hValue,
  mapMarketTokenToDisplay,
  shouldUseStockMetadataColumnsForTokens,
};
