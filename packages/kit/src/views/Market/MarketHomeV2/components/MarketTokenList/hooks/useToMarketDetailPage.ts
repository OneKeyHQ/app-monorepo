import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  rootNavigationRef,
  useIsTabletDetailView,
  useIsTabletMainView,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
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
   * Switch to Market tab first before navigating to detail page.
   * - On mobile (native): switches to Discovery tab first, then pushes detail
   * - On desktop/web: switches to Market tab first, then pushes detail
   */
  switchToMarketTabFirst?: boolean;
  /**
   * Where the navigation originated from
   */
  from?: EEnterWay;
}

export function useToDetailPage(options?: IUseToDetailPageOptions) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const isTabletMainView = useIsTabletMainView();
  const isTabletDetailView = useIsTabletDetailView();

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

      // Check if in extension popup/side panel
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        // Open in expand tab for extension popup/side panel
        // Use path format to match the rewrite pattern: /market/token/:network/:tokenAddress
        const path = `/market/token/${params.network}/${params.tokenAddress}`;

        // Determine the appropriate enter source
        const enterSource = platformEnv.isExtensionUiPopup
          ? EEnterWay.ExtensionPopup
          : EEnterWay.ExtensionSidePanel;

        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path,
          params: {
            isNative: params.isNative,
            from: params.from || enterSource,
          },
        });
      } else if (options?.switchToMarketTabFirst) {
        // First switch to the appropriate tab to highlight it
        const targetTab = platformEnv.isNative
          ? ETabRoutes.Discovery
          : ETabRoutes.Market;
        navigation.switchTab(targetTab);

        // Then navigate to detail page using rootNavigationRef
        // because the current navigation context is from modal, not from the target tab
        setTimeout(() => {
          rootNavigationRef.current?.navigate(ERootRoutes.Main, {
            screen: targetTab,
            params: {
              screen: ETabMarketRoutes.MarketDetailV2,
              params,
            },
          });
        }, 500);
      } else {
        // Regular navigation within current stack
        // Clean existing token detail pages in tablet split view mode before pushing new one
        if (isTabletMainView || isTabletDetailView) {
          appEventBus.emit(
            EAppEventBusNames.CleanTokenDetailInTabletDetailView,
            undefined,
          );
        }

        navigation.push(ETabMarketRoutes.MarketDetailV2, params);
      }
    },
    [
      navigation,
      options?.switchToMarketTabFirst,
      options?.from,
      isTabletMainView,
      isTabletDetailView,
    ],
  );

  return toMarketDetailPage;
}
