import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { MarketListingStar } from '../../../components/MarketListingStar';
import { MarketTestIDs } from '../../../testIDs';

export function MarketTopCoinStar({ token }: { token: IMarketAssetListItem }) {
  return (
    <MarketListingStar
      kind="asset"
      listingId={token.assetId}
      from={EWatchlistFrom.Homepage}
      tokenSymbol={token.symbol.toUpperCase()}
      testID={MarketTestIDs.topCoinsStarButton(token.assetId)}
    />
  );
}
