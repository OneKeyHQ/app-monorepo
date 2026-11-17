import { useRoute } from '@react-navigation/native';

import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { findLegacyMarketWatchlistItem } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import type { RouteProp } from '@react-navigation/native';

export function useMarketDetailWatchlistIdentity() {
  const { params } = useRoute<
    RouteProp<
      {
        Detail: {
          stockId?: string;
          marketTokenId?: string;
          marketTokenCategory?: string;
          tokenAddress?: string;
          network?: string;
          isNative?: boolean;
        };
      },
      'Detail'
    >
  >();
  const [watchlist] = useMarketWatchListV2Atom();
  const routeNetwork = params?.network ?? '';
  const networkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: routeNetwork }) ||
    routeNetwork;
  const savedFavorite =
    !params?.stockId && !params?.marketTokenCategory
      ? findLegacyMarketWatchlistItem(watchlist.data, {
          networkId,
          tokenAddress: params?.tokenAddress ?? '',
          isNative: String(params?.isNative) === 'true',
        })
      : undefined;
  return {
    // Asset resolution can change the native address format; keep the saved favorite's identity.
    watchlistContractAddress:
      !params?.stockId && !params?.marketTokenCategory
        ? (savedFavorite?.contractAddress ?? params?.tokenAddress)
        : undefined,
    stockId: params?.stockId,
    assetId:
      !params?.stockId &&
      params?.marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID
        ? params.marketTokenId
        : undefined,
  };
}
