import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ESplitViewType,
  rootNavigationRef,
  useIsModalPage,
  useMedia,
  useSplitViewType,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import {
  EModalMarketRoutes,
  type IModalMarketParamList,
} from '@onekeyhq/kit/src/views/Market/router/types';
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
  const tokenDetailActions = useTokenDetailActions();
  const splitViewType = useSplitViewType();
  const isModalPage = useIsModalPage();
  const media = useMedia();
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';

  return useCallback(
    async (stock: IMarketStockDetailNavigationInput) => {
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
      tokenDetailActions.current.clearTokenDetail();

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
          (
            navigation as unknown as IModalNavigationProp<IModalMarketParamList>
          ).replace(EModalMarketRoutes.MarketDetailV2, stockDetailParams);
        } else {
          navigation.replace(
            ETabMarketRoutes.MarketStockDetail,
            stockDetailParams,
          );
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
      isModalPage,
      options?.replaceCurrentDetail,
      preloadLayout,
      splitViewType,
      tokenDetailActions,
    ],
  );
}
