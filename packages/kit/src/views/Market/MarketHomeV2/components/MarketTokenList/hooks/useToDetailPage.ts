import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ETabMarketV2Routes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketV2ParamList } from '@onekeyhq/shared/src/routes';

// Change the interface to include the required fields based on actual usage
interface IMarketToken {
  tokenAddress: string;
  networkId: string;
  [key: string]: any;
}

export function useToDetailPage() {
  const navigation =
    useNavigation<IPageNavigationProp<ITabMarketV2ParamList>>();

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      navigation.push(ETabMarketV2Routes.MarketDetail, {
        tokenAddress: item.tokenAddress,
        networkId: item.networkId,
      });
    },
    [navigation],
  );

  return toDetailPage;
}
