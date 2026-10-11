import type { IMarketBasicConfigToken } from '@onekeyhq/shared/types/marketV2';

export type IRecommendWatchlistInput = Pick<
  IMarketBasicConfigToken,
  'chainId' | 'contractAddress' | 'isNative'
> & {
  assetId?: string;
  stockId?: string;
  symbol?: string;
};

export type IRecommendWatchlistItem = {
  chainId: string;
  contractAddress: string;
  isNative?: boolean;
  assetId?: string;
  stockId?: string;
};

function toDexWatchlistItem(
  token: IRecommendWatchlistInput,
): IRecommendWatchlistItem {
  return {
    chainId: token.chainId,
    contractAddress: token.contractAddress,
    isNative: token.isNative,
  };
}

function toListingWatchlistItem(assetId: string): IRecommendWatchlistItem {
  return {
    chainId: '',
    contractAddress: '',
    assetId,
  };
}

function toStockWatchlistItem(stockId: string): IRecommendWatchlistItem {
  return {
    chainId: '',
    contractAddress: '',
    stockId,
  };
}

export function copyRecommendListingIds(token: {
  assetId?: string;
  stockId?: string;
  stock?: { stockId?: string };
}): Pick<IRecommendWatchlistInput, 'assetId' | 'stockId'> {
  return {
    assetId: token.assetId,
    stockId: token.stockId ?? token.stock?.stockId,
  };
}

/**
 * A recommend row is a mainstream coin only when that row carries `assetId`.
 * Looking the symbol up in the top-coin list merges a different token that
 * happens to share the symbol, such as "Aave Token" and the asset "Aave".
 */
export function toRecommendWatchlistItem(
  token: IRecommendWatchlistInput,
): IRecommendWatchlistItem {
  const stockId = token.stockId?.trim();
  if (stockId) {
    return toStockWatchlistItem(stockId);
  }
  const assetId = token.assetId?.trim();
  if (assetId) {
    return toListingWatchlistItem(assetId);
  }
  return toDexWatchlistItem(token);
}

export function mapRecommendTokensToWatchlistItems(
  tokens: IRecommendWatchlistInput[],
): IRecommendWatchlistItem[] {
  return tokens.map((token) => toRecommendWatchlistItem(token));
}
