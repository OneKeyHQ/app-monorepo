import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import type { IMarketToken } from '../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

type IBuildMarketTokenDetailPreviewInput = Pick<
  IMarketToken,
  | 'address'
  | 'networkId'
  | 'name'
  | 'symbol'
  | 'decimals'
  | 'isNative'
  | 'price'
  | 'change24h'
  | 'marketCap'
  | 'liquidity'
  | 'holders'
  | 'turnover'
  | 'tokenImageUri'
  | 'tokenImageUris'
  | 'communityRecognized'
  | 'stock'
>;

type IBuildMarketSearchTokenDetailPreviewInput = IMarketSearchV2Token & {
  networkLogoURI?: string;
};

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toFirstOptionalNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = toOptionalNumber(value);
    if (numberValue !== undefined) {
      return numberValue;
    }
  }
  return undefined;
}

export function buildMarketTokenDetailPreview(
  token: IBuildMarketTokenDetailPreviewInput,
): IMarketTokenDetailPreview {
  return {
    address: token.address,
    networkId: token.networkId,
    isNative: token.isNative,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    price: token.price,
    change24h: token.change24h,
    marketCap: token.marketCap,
    liquidity: token.liquidity,
    holders: token.holders,
    turnover: token.turnover,
    tokenImageUri: token.tokenImageUri,
    tokenImageUris: token.tokenImageUris,
    communityRecognized: token.communityRecognized,
    stock: token.stock,
    selectedAt: Date.now(),
  };
}

export function buildMarketSearchTokenDetailPreview(
  token: IBuildMarketSearchTokenDetailPreviewInput,
): IMarketTokenDetailPreview {
  return {
    address: token.address,
    networkId: token.network,
    isNative: token.isNative,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    price: toOptionalNumber(token.price),
    change24h: toOptionalNumber(token.priceChange24hPercent),
    marketCap: toOptionalNumber(token.marketCap),
    liquidity: toOptionalNumber(token.liquidity),
    turnover: toFirstOptionalNumber(token.volume_24h, token.volume24h),
    tokenImageUri: token.logoUrl,
    tokenImageUris: token.logoUrls,
    communityRecognized: token.communityRecognized,
    stock: token.stock,
    selectedAt: Date.now(),
  };
}
