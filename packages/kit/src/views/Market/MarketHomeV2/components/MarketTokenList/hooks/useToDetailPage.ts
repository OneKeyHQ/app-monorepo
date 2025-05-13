import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';

// Change the interface to include the required fields based on actual usage
interface IMarketToken {
  coingeckoId: string;
  [key: string]: any;
}

export function useToDetailPage() {
  const navigation = useNavigation<IPageNavigationProp<ITabMarketParamList>>();

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketRoutes.MarketDetail, {
        token: item.coingeckoId,
      });
    },
    [navigation],
  );

  return toDetailPage;
}
