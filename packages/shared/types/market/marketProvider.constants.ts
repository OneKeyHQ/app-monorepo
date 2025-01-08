import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getNetworkIdsMap } from '../../src/config/networkIds';

export const getNetworkIdBySymbol = memoizee((symbol: string) => {
  const networkIdsMap = getNetworkIdsMap();
  switch (symbol) {
    case 'btc':
      return networkIdsMap.btc;
    default:
      return undefined;
  }
});
