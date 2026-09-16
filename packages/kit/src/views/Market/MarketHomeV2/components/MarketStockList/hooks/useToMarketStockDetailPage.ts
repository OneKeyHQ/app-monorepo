import { useCallback } from 'react';

import { useRoute } from '@react-navigation/native';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ESplitViewType,
  rootNavigationRef,
  switchTabAsync,
  useIsModalPage,
  useMedia,
  useSplitViewType,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketStockDetailPreview } from '@onekeyhq/shared/types/marketV2';

interface IUseToMarketStockDetailPageOptions {
  replaceCurrentDetail?: boolean;
}

export type IMarketStockDetailNavigationTarget = IMarketStockDetailPreview & {
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
};

export type IMarketStockDetailNavigationInput =
  | string
  | IMarketStockDetailNavigationTarget;

export function useToMarketStockDetailPage(
  options?: IUseToMarketStockDetailPageOptions,
) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const currentRouteName = useRoute().name;
  const tokenDetailActions = useTokenDetailActions();
  const splitViewType = useSplitViewType();
  const isModalPage = useIsModalPage();
  const media = useMedia();
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';

  return useCallback(
    async (stock: IMarketStockDetailNavigationInput) => {
      if (
        travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
        'travel-mode'
      ) {
        return;
      }
      const stockId = typeof stock === 'string' ? stock : stock.stockId;
      const stockPreview = typeof stock === 'string' ? undefined : stock;
      const stockTokenParams =
        stockPreview?.tokenAddress && stockPreview.networkId
          ? {
              tokenAddress: stockPreview.tokenAddress,
              network:
                networkUtils.getNetworkShortCode({
                  networkId: stockPreview.networkId,
                }) || stockPreview.networkId,
              isNative: stockPreview.isNative,
            }
          : undefined;
      const preloadPromise = preloadMarketDetailV2Page({
        includeBodyModules: true,
        includeHeavyModules: true,
        isStockRoute: true,
        layout: preloadLayout,
      });
      tokenDetailActions.current.prepareStockTokenDetail({
        tokenAddress: stockTokenParams?.tokenAddress ?? '',
        networkId: stockPreview?.networkId ?? '',
        isNative: stockTokenParams?.isNative,
      });

      if (
        splitViewType !== ESplitViewType.UNKNOWN &&
        !options?.replaceCurrentDetail
      ) {
        appEventBus.emit(
          EAppEventBusNames.CleanTokenDetailInTabletDetailView,
          undefined,
        );
      }

      if (platformEnv.isNative) {
        await preloadPromise;
      }

      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        const { default: backgroundApiProxy } =
          await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
        await backgroundApiProxy.serviceApp.openExtensionMarketStockDetail({
          stockId,
          ...(stockPreview
            ? {
                stockPreviewSymbol: stockPreview.symbol,
                stockPreviewName: stockPreview.name,
                stockPreviewLogoUrl: stockPreview.logoUrl,
              }
            : undefined),
          ...stockTokenParams,
          from: platformEnv.isExtensionUiPopup
            ? EEnterWay.ExtensionPopup
            : EEnterWay.ExtensionSidePanel,
        });
        closeExtensionPopupAfterExpandTabOpen();
        return;
      }

      if (options?.replaceCurrentDetail) {
        const stockDetailParams = {
          stockId,
          ...stockTokenParams,
          ...(stockPreview
            ? {
                stockPreviewSymbol: stockPreview.symbol,
                stockPreviewName: stockPreview.name,
                stockPreviewLogoUrl: stockPreview.logoUrl,
              }
            : undefined),
        };
        if (isModalPage) {
          const marketTab = platformEnv.isNative
            ? ETabRoutes.Discovery
            : ETabRoutes.Market;
          await switchTabAsync(marketTab);
          rootNavigationRef.current?.navigate(ERootRoutes.Main, {
            screen: marketTab,
            params: {
              screen: ETabMarketRoutes.MarketStockDetail,
              params: stockDetailParams,
            },
          });
        } else {
          if (currentRouteName === ETabMarketRoutes.MarketStockDetail) {
            navigation.setParams({
              stockId,
              tokenAddress: stockTokenParams?.tokenAddress,
              network: stockTokenParams?.network,
              isNative: stockTokenParams?.isNative,
              stockPreviewSymbol: stockPreview?.symbol,
              stockPreviewName: stockPreview?.name,
              stockPreviewLogoUrl: stockPreview?.logoUrl,
            });
          } else {
            // Reset the tab stack so returning from the selected stock does not
            // reveal a previously viewed non-stock detail.
            navigation.popToTop();
            navigation.push(
              ETabMarketRoutes.MarketStockDetail,
              stockDetailParams,
            );
          }
        }
        return;
      }

      rootNavigationRef.current?.navigate(ERootRoutes.Main, {
        screen: platformEnv.isNative ? ETabRoutes.Discovery : ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketStockDetail,
          params: {
            stockId,
            ...stockTokenParams,
            ...(stockPreview
              ? {
                  stockPreviewSymbol: stockPreview.symbol,
                  stockPreviewName: stockPreview.name,
                  stockPreviewLogoUrl: stockPreview.logoUrl,
                }
              : undefined),
          },
        },
      });
    },
    [
      navigation,
      currentRouteName,
      isModalPage,
      options?.replaceCurrentDetail,
      preloadLayout,
      splitViewType,
      tokenDetailActions,
    ],
  );
}
