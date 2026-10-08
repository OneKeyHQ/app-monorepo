import { useRoute } from '@react-navigation/native';

import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

import type { RouteProp } from '@react-navigation/native';

export function useMarketDetailWatchlistIdentity() {
  const { params } = useRoute<
    RouteProp<
      {
        Detail: {
          stockId?: string;
          marketTokenId?: string;
          marketTokenCategory?: string;
        };
      },
      'Detail'
    >
  >();
  return {
    stockId: params?.stockId,
    assetId:
      !params?.stockId &&
      params?.marketTokenCategory === MARKET_TOP_COINS_CATEGORY_ID
        ? params.marketTokenId
        : undefined,
  };
}
