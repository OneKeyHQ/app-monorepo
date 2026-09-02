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
const IDENTITY_CACHE_TTL_MS = 50_000;
const IDENTITY_REQUEST_CONCURRENCY = 3;
const identityRequestQueues = Array.from(
  { length: IDENTITY_REQUEST_CONCURRENCY },
  () => Promise.resolve(),
);
let nextIdentityRequestQueue = 0;
const identityCache = new Map<
  string,
  { identity: IMarketWatchlistIdentity; expiresAt: number }
>();
const identityRequestCache = new Map<
  string,
  Promise<IMarketWatchlistIdentity | undefined>
>();

function scheduleIdentityRequest<T>(request: () => Promise<T>) {
  const queueIndex = nextIdentityRequestQueue;
  nextIdentityRequestQueue =
    (nextIdentityRequestQueue + 1) % IDENTITY_REQUEST_CONCURRENCY;
  const result = identityRequestQueues[queueIndex].then(request, request);
  identityRequestQueues[queueIndex] = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function resolveMarketTopCoinIdentity(assetId: string) {
  const cached = identityCache.get(assetId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.identity;
  }
  identityCache.delete(assetId);
  const pendingRequest = identityRequestCache.get(assetId);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = scheduleIdentityRequest(() =>
    resolveMarketTopCoinNavigationTarget({ assetId }),
  )
    .then((target) => {
      const identity = {
        chainId: target.networkId,
        contractAddress: target.tokenAddress,
        isNative: target.isNative,
      };
      identityCache.set(assetId, {
        identity,
        expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS,
      });
      return identity;
    })
    .finally(() => identityRequestCache.delete(assetId));
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
