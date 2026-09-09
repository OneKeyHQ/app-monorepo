import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ESplitViewType,
  rootNavigationRef,
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
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import type { IMarketStockDetailPreview } from '@onekeyhq/shared/types/marketV2';

interface IUseToMarketStockDetailPageOptions {
  replaceCurrentDetail?: boolean;
}

export function useToMarketStockDetailPage(
  options?: IUseToMarketStockDetailPageOptions,
) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const tokenDetailActions = useTokenDetailActions();
  const splitViewType = useSplitViewType();
  const media = useMedia();
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';

  return useCallback(
    async (stock: string | IMarketStockDetailPreview) => {
      const stockId = typeof stock === 'string' ? stock : stock.stockId;
      const stockPreview = typeof stock === 'string' ? undefined : stock;
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
          from: platformEnv.isExtensionUiPopup
            ? EEnterWay.ExtensionPopup
            : EEnterWay.ExtensionSidePanel,
        });
        closeExtensionPopupAfterExpandTabOpen();
        return;
      }

      if (options?.replaceCurrentDetail) {
        navigation.replace(ETabMarketRoutes.MarketStockDetail, {
          stockId,
          ...(stockPreview
            ? {
                stockPreviewSymbol: stockPreview.symbol,
                stockPreviewName: stockPreview.name,
                stockPreviewLogoUrl: stockPreview.logoUrl,
              }
            : undefined),
        });
        return;
      }

      rootNavigationRef.current?.navigate(ERootRoutes.Main, {
        screen: platformEnv.isNative ? ETabRoutes.Discovery : ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketStockDetail,
          params: {
            stockId,
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
      options?.replaceCurrentDetail,
      preloadLayout,
      splitViewType,
      tokenDetailActions,
    ],
  );
}
