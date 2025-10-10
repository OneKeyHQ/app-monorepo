import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

interface IMarketToken {
  tokenAddress: string;
  networkId: string;
  symbol: string;
  isNative?: boolean;
}

interface IUseToDetailPageOptions {
  /**
   * Force navigation through root navigator (used in universal search)
   */
  useRootNavigation?: boolean;
  /**
   * Where the navigation originated from
   */
  from?: EEnterWay;
}

export function useToDetailPage(options?: IUseToDetailPageOptions) {
  const navigation = useNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const tokenDetailActions = useTokenDetailActions();

  const toMarketDetailPage = useCallback(
    async (item: IMarketToken) => {
      const shortCode = networkUtils.getNetworkShortCode({
        networkId: item.networkId,
      });

      const params = {
        tokenAddress: item.tokenAddress,
        network: shortCode || item.networkId,
        isNative: item.isNative,
        from: options?.from,
      };

      // Check if in extension popup/side panel and using root navigation
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        // Open in expand tab (fullscreen) for extension popup/side panel
        // Use path format to match the rewrite pattern: /market/token/:network/:tokenAddress
        const path = `/market/token/${params.network}/${params.tokenAddress}`;
        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path,
          params: {
            isNative: params.isNative,
            from: params.from,
          },
        });
      } else if (options?.useRootNavigation) {
        // Use root navigation for other cases (expand tab, desktop, web, mobile)
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params,
          },
        });
      } else {
        // Regular navigation within current stack
        // Always clear token detail when navigating
        tokenDetailActions.current.clearTokenDetail();

        navigation.push(ETabMarketRoutes.MarketDetailV2, params);
      }
    },
    [navigation, tokenDetailActions, options?.useRootNavigation, options?.from],
  );

  return toMarketDetailPage;
}
