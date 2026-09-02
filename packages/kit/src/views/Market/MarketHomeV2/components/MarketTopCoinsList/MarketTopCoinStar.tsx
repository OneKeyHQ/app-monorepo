import { useCallback } from 'react';

import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import {
  type IMarketWatchlistIdentity,
  MarketAsyncStarV2,
} from '../../../components/MarketAsyncStarV2';
import { MarketTestIDs } from '../../../testIDs';

import { resolveMarketTopCoinNavigationTarget } from './hooks/useMarketTopCoins';

const EMPTY_IDENTITIES: IMarketWatchlistIdentity[] = [];
const identityCache = new Map<string, IMarketWatchlistIdentity>();
const identityRequestCache = new Map<
  string,
  Promise<IMarketWatchlistIdentity | undefined>
>();

async function resolveMarketTopCoinIdentity(assetId: string) {
  const cachedIdentity = identityCache.get(assetId);
  if (cachedIdentity) {
    return cachedIdentity;
  }
  const pendingRequest = identityRequestCache.get(assetId);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = resolveMarketTopCoinNavigationTarget({ assetId })
    .then((target) => {
      const identity = {
        chainId: target.networkId,
        contractAddress: target.tokenAddress,
        isNative: target.isNative,
      };
      identityCache.set(assetId, identity);
      return identity;
    })
    .finally(() => {
      identityRequestCache.delete(assetId);
    });
  identityRequestCache.set(assetId, request);
  return request;
}

export function MarketTopCoinStar({ token }: { token: IMarketAssetListItem }) {
  const resolveIdentity = useCallback(
    () => resolveMarketTopCoinIdentity(token.assetId),
    [token.assetId],
  );

  return (
    <MarketAsyncStarV2
      identities={EMPTY_IDENTITIES}
      resolveIdentity={resolveIdentity}
      identityKey={token.assetId}
      resolveOnMount
      from={EWatchlistFrom.Homepage}
      tokenSymbol={token.symbol.toUpperCase()}
      testID={MarketTestIDs.topCoinsStarButton(token.assetId)}
      iconSize="$5"
    />
  );
}
