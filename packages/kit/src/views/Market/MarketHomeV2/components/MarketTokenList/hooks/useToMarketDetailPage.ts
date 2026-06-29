import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ESplitViewType,
  rootNavigationRef,
  useSplitViewType,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
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
  /**
   * Controls whether the detail page displays the favorite/watchlist button.
   */
  showFavoriteButton?: boolean;
}

const EXTENSION_POPUP_CLOSE_DELAY_MS = 100;

export function useToDetailPage(options?: IUseToDetailPageOptions) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const tokenDetailActions = useTokenDetailActions();
  const splitViewType = useSplitViewType();

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
        ...(typeof options?.showFavoriteButton === 'boolean'
          ? { showFavoriteButton: options.showFavoriteButton }
          : undefined),
      };

      // Check if in extension popup/side panel
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        // Determine the appropriate enter source
        const enterSource = platformEnv.isExtensionUiPopup
          ? EEnterWay.ExtensionPopup
          : EEnterWay.ExtensionSidePanel;

        await backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
          ...params,
          from: params.from || enterSource,
        });
        if (platformEnv.isExtensionUiPopup) {
          // Keep the popup alive long enough for caller-side follow-up timers,
          // such as recent-search persistence, to run before the page closes.
          setTimeout(() => {
            globalThis.close();
          }, EXTENSION_POPUP_CLOSE_DELAY_MS);
        }
      } else if (options?.switchToMarketTabFirst) {
        // Clear token detail before navigation
        tokenDetailActions.current.clearTokenDetail();

        const targetTab = platformEnv.isNative
          ? ETabRoutes.Discovery
          : ETabRoutes.Market;

        if (platformEnv.isNative) {
          // Navigate directly to the nested detail route to avoid briefly
          // revealing the Discovery root page before entering Market detail.
          rootNavigationRef.current?.navigate(ERootRoutes.Main, {
            screen: targetTab,
            params: {
              screen: ETabMarketRoutes.MarketDetailV2,
              params,
            },
          });
        } else {
          // First switch to the appropriate tab to highlight it
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
        }
      } else {
        // Clear token detail before navigation
        tokenDetailActions.current.clearTokenDetail();

        // Clean existing token detail pages in tablet split view mode before pushing new one
        if (splitViewType !== ESplitViewType.UNKNOWN) {
          navigation.switchTab(ETabRoutes.Discovery);
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
      tokenDetailActions,
      options?.switchToMarketTabFirst,
      options?.from,
      options?.showFavoriteButton,
      splitViewType,
    ],
  );

  return toMarketDetailPage;
}
