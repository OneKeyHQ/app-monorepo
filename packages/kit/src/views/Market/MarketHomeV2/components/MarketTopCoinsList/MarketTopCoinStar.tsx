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

export function MarketTopCoinStar({ token }: { token: IMarketAssetListItem }) {
  const resolveIdentity = useCallback(async () => {
    const target = await resolveMarketTopCoinNavigationTarget(token);
    if (!target) {
      return undefined;
    }
    return {
      chainId: target.networkId,
      contractAddress: target.tokenAddress,
      isNative: target.isNative,
    };
  }, [token]);

  return (
    <MarketAsyncStarV2
      identities={EMPTY_IDENTITIES}
      resolveIdentity={resolveIdentity}
      from={EWatchlistFrom.Homepage}
      tokenSymbol={token.symbol.toUpperCase()}
      testID={MarketTestIDs.topCoinsStarButton(token.assetId)}
      iconSize="$5"
    />
  );
}
