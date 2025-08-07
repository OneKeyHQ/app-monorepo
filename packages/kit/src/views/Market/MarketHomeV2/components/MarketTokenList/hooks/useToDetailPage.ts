import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ETabMarketRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

interface IMarketToken {
  tokenAddress: string;
  networkId: string;
  symbol: string;
}

export function useToDetailPage() {
  const navigation2 = useAppNavigation();
  const navigation = useNavigation<IPageNavigationProp<ITabMarketParamList>>();

  const toDetailPage = useCallback(
    (item: IMarketToken) => {
      if (platformEnv.isNative) {
        navigation2.pushModal(EModalRoutes.MarketModal, {
          screen: EModalMarketRoutes.MarketDetailV2,
          params: {
            tokenAddress: item.tokenAddress,
            networkId: item.networkId,
            symbol: item.symbol,
          },
        });
      } else {
        navigation.push(ETabMarketRoutes.MarketDetailV2, {
          tokenAddress: item.tokenAddress,
          networkId: item.networkId,
          symbol: item.symbol,
        });
      }
    },
    [navigation, navigation2],
  );

  return toDetailPage;
}
