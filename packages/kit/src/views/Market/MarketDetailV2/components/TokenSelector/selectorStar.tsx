import { memo } from 'react';

import { IconButton } from '@onekeyhq/components';
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { isMarketSearchStockListing } from '@onekeyhq/shared/src/utils/marketSearchStock';

import { MarketListingStar } from '../../../components/MarketListingStar';
import {
  usePerpsStarV2Checked,
  useStarV2Checked,
} from '../../../components/MarketStarV2';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

/**
 * The favorite star of a token-shaped selector row, shared by the desktop
 * popover and the mobile modal so both add, remove and draw favorites alike.
 * A top-coin row carries `marketAssetId` and favorites the asset listing;
 * every other row uses the spot (or perps) watchlist hooks with an IconButton
 * that matches the perps FavoriteButton.
 */
function BasicSelectorTokenStar({
  item,
  networkId,
}: {
  item: IMarketToken & { marketAssetId?: string };
  networkId?: string;
}) {
  const chainId = item.chainId ?? networkId ?? item.networkId ?? '';
  const isStockListing = isMarketSearchStockListing({
    stockId: item.stockId,
    network: chainId,
    address: item.address,
  });
  const spotStar = useStarV2Checked({
    assetId: item.assetId,
    stockId: isStockListing ? item.stockId : undefined,
    chainId,
    contractAddress: item.address,
    from: EWatchlistFrom.Search,
    tokenSymbol: item.symbol,
    isNative: item.isNative,
  });
  const perpsStar = usePerpsStarV2Checked({
    perpsCoin: item.perpsCoin ?? '',
  });
  const star = item.perpsCoin ? perpsStar : spotStar;

  if (item.marketAssetId) {
    return (
      <MarketListingStar
        kind="asset"
        listingId={item.marketAssetId}
        from={EWatchlistFrom.Search}
      />
    );
  }
  return (
    <IconButton
      testID={MarketTestIDs.tokenSelectorRowStarBtn}
      icon={star.checked ? 'StarSolid' : 'StarOutline'}
      variant="tertiary"
      size="small"
      iconProps={{
        color: star.checked ? '$iconActive' : '$iconSubdued',
        size: '$4',
      }}
      onPress={star.onPress}
    />
  );
}

export const SelectorTokenStar = memo(BasicSelectorTokenStar);
