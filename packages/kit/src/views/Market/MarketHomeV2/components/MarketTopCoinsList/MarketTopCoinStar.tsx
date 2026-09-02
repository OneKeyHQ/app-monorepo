import { useCallback } from 'react';

import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import {
  type IMarketIdentityResolveOptions,
  type IMarketWatchlistIdentity,
  MarketAsyncStarV2,
  createCachedMarketIdentityResolver,
} from '../../../components/MarketAsyncStarV2';
import { MarketTestIDs } from '../../../testIDs';

import { resolveMarketTopCoinNavigationTarget } from './hooks/useMarketTopCoins';

const EMPTY_IDENTITIES: IMarketWatchlistIdentity[] = [];
const resolveMarketTopCoinIdentity = createCachedMarketIdentityResolver({
  failureCacheTtlMs: 30_000,
  load: async (assetId: string) => {
    const target = await resolveMarketTopCoinNavigationTarget({ assetId });
    return {
      chainId: target.networkId,
      contractAddress: target.tokenAddress,
      isNative: target.isNative,
    };
  },
});

export function MarketTopCoinStar({ token }: { token: IMarketAssetListItem }) {
  const resolveIdentity = useCallback(
    (options?: IMarketIdentityResolveOptions) =>
      resolveMarketTopCoinIdentity(token.assetId, options),
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
