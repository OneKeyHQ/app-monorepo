import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  ETabMarketRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

interface IMarketToken {
  tokenAddress: string;
  networkId: string;
  symbol: string;
  isNative?: boolean;
}

export function useToDetailPage() {
  const navigation = useNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const tokenDetailActions = useTokenDetailActions();

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      // Clear previous tokenDetail data before navigation
      tokenDetailActions.current.clearTokenDetail();

      navigation.push(ETabMarketRoutes.MarketDetailV2, {
        tokenAddress: item.tokenAddress,
        networkId: item.networkId,
        symbol: item.symbol,
        isNative: item.isNative,
      });
    },
    [navigation, tokenDetailActions],
  );

  return toDetailPage;
}
