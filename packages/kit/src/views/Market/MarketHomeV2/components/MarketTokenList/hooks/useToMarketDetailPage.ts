import { useCallback, useEffect } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ESplitViewType,
  rootNavigationRef,
  useMedia,
  useSplitViewType,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { prewarmMarketTokenImages } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload';
import {
  prefetchMarketDetailV2FirstScreenKLine,
  prefetchMarketDetailV2FirstScreenTransactions,
  preloadMarketDetailV2Page,
  prepareMarketDetailV2KlineSource,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { buildMarketTokenDetailPreview } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPreview';
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
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import type { IMarketToken as IMarketHomeToken } from '../MarketTokenData';

interface IMarketToken extends Partial<IMarketHomeToken> {
  tokenAddress: string;
  networkId: string;
  symbol: string;
  isNative?: boolean;
}

function buildMarketDetailRouteParams(
  item: IMarketToken,
  options?: IUseToDetailPageOptions,
) {
  const shortCode = networkUtils.getNetworkShortCode({
    networkId: item.networkId,
  });

  return {
    tokenAddress: item.tokenAddress,
    network: shortCode || item.networkId,
    isNative: item.isNative,
    from: options?.from,
    ...(typeof options?.showFavoriteButton === 'boolean'
      ? { showFavoriteButton: options.showFavoriteButton }
      : undefined),
  };
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

export function useToDetailPage(options?: IUseToDetailPageOptions) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const tokenDetailActions = useTokenDetailActions();
  const splitViewType = useSplitViewType();
  const media = useMedia();
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';
  const {
    switchToMarketTabFirst,
    from: enterFrom,
    showFavoriteButton,
  } = options ?? {};

  useEffect(() => {
    void preloadMarketDetailV2Page();
  }, []);

  const startTokenDetailRequest = useCallback(
    (
      item: IMarketToken,
      { includeTransactions = true }: { includeTransactions?: boolean } = {},
    ) => {
      prepareMarketDetailV2KlineSource({
        tokenAddress: item.tokenAddress,
        networkId: item.networkId,
      });
      const previewAddress = item.address ?? item.tokenAddress;
      let tokenDetailPreview: IMarketTokenDetailPreview | undefined;

      if (
        (previewAddress || item.isNative) &&
        item.name &&
        typeof item.decimals === 'number'
      ) {
        tokenDetailPreview = buildMarketTokenDetailPreview({
          ...(item as IMarketHomeToken),
          address: previewAddress,
          networkId: item.networkId,
          symbol: item.symbol,
          isNative: item.isNative,
        });

        prewarmMarketTokenImages(tokenDetailPreview);
      }

      void tokenDetailActions.current.changeActiveToken({
        tokenAddress: item.tokenAddress,
        networkId: item.networkId,
        historyStartTime: item.firstTradeTime,
        isNative: item.isNative ?? false,
        tokenDetailPreview,
      });
      void prefetchMarketDetailV2FirstScreenKLine({
        tokenAddress: item.tokenAddress,
        networkId: item.networkId,
        historyStartTime: item.firstTradeTime,
      }).catch(() => undefined);
      if (includeTransactions) {
        void prefetchMarketDetailV2FirstScreenTransactions({
          tokenAddress: item.tokenAddress,
          networkId: item.networkId,
        }).catch(() => undefined);
      }
    },
    [tokenDetailActions],
  );

  const toMarketDetailPage = useCallback(
    async (item: IMarketToken) => {
      const marketDetailShellPreloadPromise = preloadMarketDetailV2Page({
        includeBodyModules: true,
        includeHeavyModules: true,
        layout: preloadLayout,
      });
      const params = buildMarketDetailRouteParams(item, {
        from: enterFrom,
        showFavoriteButton,
      });

      // Check if in extension popup/side panel
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        // Determine the appropriate enter source
        const enterSource = platformEnv.isExtensionUiPopup
          ? EEnterWay.ExtensionPopup
          : EEnterWay.ExtensionSidePanel;

        const { default: backgroundApiProxy } =
          await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
        await backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
          ...params,
          from: params.from || enterSource,
        });
        closeExtensionPopupAfterExpandTabOpen();
      } else if (switchToMarketTabFirst) {
        startTokenDetailRequest(item);

        const targetTab = platformEnv.isNative
          ? ETabRoutes.Discovery
          : ETabRoutes.Market;

        if (platformEnv.isNative) {
          await marketDetailShellPreloadPromise;
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
        startTokenDetailRequest(item);

        // Clean existing token detail pages in tablet split view mode before pushing new one
        if (splitViewType !== ESplitViewType.UNKNOWN) {
          navigation.switchTab(ETabRoutes.Discovery);
          appEventBus.emit(
            EAppEventBusNames.CleanTokenDetailInTabletDetailView,
            undefined,
          );
        }

        if (platformEnv.isNative) {
          await marketDetailShellPreloadPromise;
        }
        navigation.push(ETabMarketRoutes.MarketDetailV2, params);
      }
    },
    [
      navigation,
      startTokenDetailRequest,
      switchToMarketTabFirst,
      enterFrom,
      showFavoriteButton,
      preloadLayout,
      splitViewType,
    ],
  );

  return toMarketDetailPage;
}
