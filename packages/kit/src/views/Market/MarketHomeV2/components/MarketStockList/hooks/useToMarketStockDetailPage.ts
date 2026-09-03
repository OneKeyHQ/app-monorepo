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
    async (stockId: string) => {
      const preloadPromise = preloadMarketDetailV2Page({
        includeBodyModules: true,
        includeHeavyModules: true,
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
          from: platformEnv.isExtensionUiPopup
            ? EEnterWay.ExtensionPopup
            : EEnterWay.ExtensionSidePanel,
        });
        closeExtensionPopupAfterExpandTabOpen();
        return;
      }

      if (options?.replaceCurrentDetail) {
        navigation.replace(ETabMarketRoutes.MarketStockDetail, { stockId });
        return;
      }

      rootNavigationRef.current?.navigate(ERootRoutes.Main, {
        screen: platformEnv.isNative ? ETabRoutes.Discovery : ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketStockDetail,
          params: { stockId },
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
