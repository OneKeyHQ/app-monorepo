import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ETabMarketRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

interface IMarketToken {
  tokenAddress: string;
  networkId: string;
  symbol: string;
}

export function useToDetailPage() {
  const navigation = useNavigation<IPageNavigationProp<ITabMarketParamList>>();

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketRoutes.MarketDetailV2, {
        tokenAddress: item.tokenAddress,
        networkId: item.networkId,
        symbol: item.symbol,
      });
    },
    [navigation],
  );

  return toDetailPage;
}
