import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAssetVariant } from '@onekeyhq/shared/types/market';
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

export type IRecommendListingIdentity = {
  assetId: string;
  chainId: string;
  contractAddress: string;
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

function hasExplicitListingId(token: IRecommendWatchlistInput) {
  return Boolean(token.assetId?.trim() || token.stockId?.trim());
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

export function toRecommendWatchlistItem({
  token,
  listings,
}: {
  token: IRecommendWatchlistInput;
  listings: IRecommendListingIdentity[];
}): IRecommendWatchlistItem {
  const stockId = token.stockId?.trim();
  if (stockId) {
    return toStockWatchlistItem(stockId);
  }
  const assetId = matchRecommendTokenAssetId({ token, listings });
  return assetId ? toListingWatchlistItem(assetId) : toDexWatchlistItem(token);
}

export function matchRecommendTokenAssetId({
  token,
  listings,
}: {
  token: IRecommendWatchlistInput;
  listings: IRecommendListingIdentity[];
}): string | undefined {
  const explicitAssetId = token.assetId?.trim();
  if (explicitAssetId) {
    return explicitAssetId;
  }
  return listings.find((listing) =>
    equalTokenNoCaseSensitive({
      token1: {
        networkId: token.chainId,
        contractAddress: token.contractAddress,
      },
      token2: {
        networkId: listing.chainId,
        contractAddress: listing.contractAddress,
      },
    }),
  )?.assetId;
}

function collectRecommendSymbols(tokens: IRecommendWatchlistInput[]) {
  return new Set(
    tokens
      .map((token) => token.symbol?.trim().toUpperCase())
      .filter((symbol): symbol is string => Boolean(symbol)),
  );
}

function collectAssetListingIdentities({
  assetId,
  selectedVariant,
  variants,
}: {
  assetId: string;
  selectedVariant?: Pick<
    IMarketAssetVariant,
    'networkId' | 'tokenAddress' | 'isNative'
  > | null;
  variants?: Array<
    | Pick<IMarketAssetVariant, 'networkId' | 'tokenAddress' | 'isNative'>
    | null
    | undefined
  >;
}): IRecommendListingIdentity[] {
  const listings: IRecommendListingIdentity[] = [];
  const seen = new Set<string>();
  for (const variant of [selectedVariant, ...(variants ?? [])]) {
    const contractAddress = variant?.tokenAddress ?? '';
    const key = variant?.networkId
      ? `${variant.networkId}:${contractAddress.toLowerCase()}`
      : '';
    const isUsable =
      Boolean(key) &&
      (Boolean(variant?.isNative) || Boolean(contractAddress.trim()));
    if (isUsable && variant?.networkId && !seen.has(key)) {
      seen.add(key);
      listings.push({
        assetId,
        chainId: variant.networkId,
        contractAddress,
      });
    }
  }
  return listings;
}

const resolveRecommendListingLimit = pLimit(4);

async function loadRecommendListingIdentities(
  tokens: IRecommendWatchlistInput[],
): Promise<IRecommendListingIdentity[]> {
  const symbols = collectRecommendSymbols(tokens);
  if (symbols.size === 0) {
    return [];
  }

  const { list } = await backgroundApiProxy.serviceMarket.fetchMarketAssetList({
    currency: 'usd',
    type: 'top_coins',
    page: 1,
    limit: 100,
  });
  const candidates = list.filter((item) =>
    symbols.has(item.symbol.toUpperCase()),
  );
  const resolved = await Promise.all(
    candidates.map((item) =>
      resolveRecommendListingLimit(async () => {
        try {
          const detail =
            await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
              assetId: item.assetId,
              currency: 'usd',
              autoHandleError: false,
            });
          return collectAssetListingIdentities({
            assetId: item.assetId,
            selectedVariant: detail.selectedVariant,
            variants: detail.variants,
          });
        } catch {
          // Keep listings that already resolved; one failed detail
          // must not send the whole batch down the DEX fallback.
          return [];
        }
      }),
    ),
  );
  return resolved.flat();
}

export async function mapRecommendTokensToWatchlistItems(
  tokens: IRecommendWatchlistInput[],
): Promise<IRecommendWatchlistItem[]> {
  if (!tokens.length) {
    return [];
  }
  if (tokens.every((token) => hasExplicitListingId(token))) {
    return tokens.map((token) =>
      toRecommendWatchlistItem({ token, listings: [] }),
    );
  }

  let listings: IRecommendListingIdentity[] = [];
  try {
    listings = await loadRecommendListingIdentities(
      tokens.filter((token) => !hasExplicitListingId(token)),
    );
  } catch {
    listings = [];
  }

  return tokens.map((token) => toRecommendWatchlistItem({ token, listings }));
}
