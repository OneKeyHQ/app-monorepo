import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketBasicConfigToken } from '@onekeyhq/shared/types/marketV2';

import { resolveMarketListingWatchlistIdentity } from './marketListingWatchlistIdentity';

export type IRecommendWatchlistInput = Pick<
  IMarketBasicConfigToken,
  'chainId' | 'contractAddress' | 'isNative'
> & {
  assetId?: string;
  symbol?: string;
};

export type IRecommendWatchlistItem = {
  chainId: string;
  contractAddress: string;
  isNative?: boolean;
  assetId?: string;
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

async function loadRecommendListingIdentities(
  tokens: IRecommendWatchlistInput[],
): Promise<IRecommendListingIdentity[]> {
  const { list } = await backgroundApiProxy.serviceMarket.fetchMarketAssetList({
    currency: 'usd',
    type: 'top_coins',
    page: 1,
    limit: 100,
  });
  const symbols = collectRecommendSymbols(tokens);
  const candidates = list.filter((item) =>
    symbols.size === 0 ? true : symbols.has(item.symbol.toUpperCase()),
  );
  const resolved = await Promise.all(
    candidates.map(async (item) => {
      const identity = await resolveMarketListingWatchlistIdentity(
        'asset',
        item.assetId,
      );
      if (!identity) {
        return undefined;
      }
      return {
        assetId: item.assetId,
        chainId: identity.chainId,
        contractAddress: identity.contractAddress,
      };
    }),
  );
  return resolved.filter((item): item is IRecommendListingIdentity =>
    Boolean(item),
  );
}

export async function mapRecommendTokensToWatchlistItems(
  tokens: IRecommendWatchlistInput[],
): Promise<IRecommendWatchlistItem[]> {
  if (!tokens.length) {
    return [];
  }
  if (tokens.every((token) => token.assetId?.trim())) {
    return tokens.map((token) =>
      toListingWatchlistItem(token.assetId?.trim() ?? ''),
    );
  }

  let listings: IRecommendListingIdentity[] = [];
  try {
    listings = await loadRecommendListingIdentities(tokens);
  } catch {
    listings = [];
  }

  return tokens.map((token) => {
    const assetId = matchRecommendTokenAssetId({ token, listings });
    return assetId
      ? toListingWatchlistItem(assetId)
      : toDexWatchlistItem(token);
  });
}
