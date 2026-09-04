import { useCallback, useEffect, useRef } from 'react';

import { useRoute } from '@react-navigation/native';

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
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { buildMarketTokenDetailPreview } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPreview';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { resolveMarketAssetRouteIdentity } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveMarketAssetRouteIdentity';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
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
  marketTokenId?: string;
  marketVariantId?: string;
  skipMarketDataFetch?: boolean;
  disableTrade?: boolean;
  showFavoriteButton?: boolean;
  tokenDetailPreview?: IMarketTokenDetailPreview;
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
  /**
   * Preserves the Market list category so desktop detail can select the
   * matching information architecture (for example Top Coins vs Trending).
   */
  marketTokenCategory?: string;
  /**
   * Avoid stacking another detail page when switching assets from Market detail.
   * A different detail route is replaced, while the same route is updated in place.
   */
  replaceCurrentDetail?: boolean;
  /**
   * Resolves a search/watchlist token to its canonical Asset route identity.
   */
  resolveMarketAsset?: boolean;
}

export function useToDetailPage(options?: IUseToDetailPageOptions) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const currentRouteName = useRoute().name;
  const tokenDetailActions = useTokenDetailActions();
  const navigationGenerationRef = useRef(0);
  const splitViewType = useSplitViewType();
  const media = useMedia();
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';

  useEffect(() => {
    void preloadMarketDetailV2Page();
  }, []);

  const preparePreviewTokenDetail = useCallback(
    (item: IMarketToken) => {
      if (item.tokenDetailPreview) {
        prewarmMarketTokenImages(item.tokenDetailPreview);
        tokenDetailActions.current.prepareTokenDetailPreview(
          item.tokenDetailPreview,
        );
        return;
      }

      const previewAddress = item.address ?? item.tokenAddress;

      if (
        (!previewAddress && !item.isNative) ||
        !item.name ||
        typeof item.decimals !== 'number'
      ) {
        tokenDetailActions.current.clearTokenDetail();
        return;
      }

      const tokenDetailPreview = buildMarketTokenDetailPreview({
        ...(item as IMarketHomeToken),
        address: previewAddress,
        networkId: item.networkId,
        symbol: item.symbol,
        isNative: item.isNative,
      });

      prewarmMarketTokenImages(tokenDetailPreview);
      tokenDetailActions.current.prepareTokenDetailPreview(tokenDetailPreview);
    },
    [tokenDetailActions],
  );

  const toMarketDetailPage = useCallback(
    async (item: IMarketToken) => {
      const navigationGeneration = navigationGenerationRef.current + 1;
      navigationGenerationRef.current = navigationGeneration;
      const shouldResolveMarketAsset = Boolean(
        options?.resolveMarketAsset && !item.marketTokenId && !item.stock,
      );

      if (
        shouldResolveMarketAsset &&
        !platformEnv.isExtensionUiPopup &&
        !platformEnv.isExtensionUiSidePanel
      ) {
        preparePreviewTokenDetail(item);
      }

      const marketAssetIdentity = shouldResolveMarketAsset
        ? await resolveMarketAssetRouteIdentity({
            networkId: item.networkId,
            tokenAddress: item.tokenAddress,
            symbol: item.symbol,
            isNative: item.isNative,
          })
        : undefined;
      if (navigationGenerationRef.current !== navigationGeneration) {
        return;
      }
      const resolvedItem = marketAssetIdentity
        ? {
            ...item,
            ...marketAssetIdentity,
            ...(item.tokenDetailPreview
              ? {
                  tokenDetailPreview: {
                    ...item.tokenDetailPreview,
                    address: marketAssetIdentity.tokenAddress,
                    networkId: marketAssetIdentity.networkId,
                    isNative: marketAssetIdentity.isNative,
                  },
                }
              : undefined),
          }
        : item;
      const marketTokenCategory = marketAssetIdentity
        ? MARKET_TOP_COINS_CATEGORY_ID
        : options?.marketTokenCategory;
      const stockId = resolveMarketStockId(resolvedItem);
      const marketDetailShellPreloadPromise = preloadMarketDetailV2Page({
        includeBodyModules: true,
        includeHeavyModules: true,
        isStockRoute: Boolean(stockId),
        layout: preloadLayout,
      });
      const shortCode = networkUtils.getNetworkShortCode({
        networkId: resolvedItem.networkId,
      });
      const showFavoriteButton =
        typeof resolvedItem.showFavoriteButton === 'boolean'
          ? resolvedItem.showFavoriteButton
          : options?.showFavoriteButton;

      const tokenParams = {
        tokenAddress: resolvedItem.tokenAddress,
        network: shortCode || resolvedItem.networkId,
        isNative: resolvedItem.isNative,
        from: options?.from,
        ...(resolvedItem.marketTokenId
          ? { marketTokenId: resolvedItem.marketTokenId }
          : undefined),
        ...(resolvedItem.marketVariantId
          ? { marketVariantId: resolvedItem.marketVariantId }
          : undefined),
        ...(resolvedItem.skipMarketDataFetch
          ? { skipMarketDataFetch: true }
          : undefined),
        ...(typeof resolvedItem.disableTrade === 'boolean'
          ? { disableTrade: resolvedItem.disableTrade }
          : undefined),
        ...(marketTokenCategory ? { marketTokenCategory } : undefined),
        ...(typeof showFavoriteButton === 'boolean'
          ? { showFavoriteButton }
          : undefined),
      };
      const stockParams = stockId
        ? {
            stockId,
            tokenAddress: tokenParams.tokenAddress,
            network: tokenParams.network,
            isNative: tokenParams.isNative,
            from: options?.from,
            ...(typeof tokenParams.disableTrade === 'boolean'
              ? { disableTrade: tokenParams.disableTrade }
              : undefined),
            ...(typeof tokenParams.showFavoriteButton === 'boolean'
              ? { showFavoriteButton: tokenParams.showFavoriteButton }
              : undefined),
          }
        : undefined;
      const params = stockParams ?? tokenParams;
      const detailRouteName = stockId
        ? ETabMarketRoutes.MarketStockDetail
        : ETabMarketRoutes.MarketDetailV2;
      const shouldReplaceCurrentDetail = Boolean(
        options?.replaceCurrentDetail && currentRouteName !== detailRouteName,
      );

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
        if (navigationGenerationRef.current !== navigationGeneration) {
          return;
        }
        if (stockId) {
          await backgroundApiProxy.serviceApp.openExtensionMarketStockDetail({
            stockId,
            tokenAddress: tokenParams.tokenAddress,
            network: tokenParams.network,
            isNative: tokenParams.isNative,
            disableTrade: tokenParams.disableTrade,
            showFavoriteButton: tokenParams.showFavoriteButton,
            from: tokenParams.from || enterSource,
          });
        } else {
          await backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
            ...tokenParams,
            from: tokenParams.from || enterSource,
            tokenDetailPreview: resolvedItem.tokenDetailPreview,
          });
        }
        if (navigationGenerationRef.current !== navigationGeneration) {
          return;
        }
        closeExtensionPopupAfterExpandTabOpen();
      } else if (options?.switchToMarketTabFirst) {
        if (stockId) {
          tokenDetailActions.current.clearTokenDetail();
        } else {
          preparePreviewTokenDetail(resolvedItem);
        }

        const targetTab = platformEnv.isNative
          ? ETabRoutes.Discovery
          : ETabRoutes.Market;

        if (platformEnv.isNative) {
          await marketDetailShellPreloadPromise;
          if (navigationGenerationRef.current !== navigationGeneration) {
            return;
          }
          // Navigate directly to the nested detail route to avoid briefly
          // revealing the Discovery root page before entering Market detail.
          rootNavigationRef.current?.navigate(ERootRoutes.Main, {
            screen: targetTab,
            params: {
              screen: detailRouteName,
              params,
            },
          });
        } else {
          // First switch to the appropriate tab to highlight it
          navigation.switchTab(targetTab);

          // Then navigate to detail page using rootNavigationRef
          // because the current navigation context is from modal, not from the target tab
          setTimeout(() => {
            if (navigationGenerationRef.current !== navigationGeneration) {
              return;
            }
            rootNavigationRef.current?.navigate(ERootRoutes.Main, {
              screen: targetTab,
              params: {
                screen: detailRouteName,
                params,
              },
            });
          }, 500);
        }
      } else {
        if (stockId) {
          tokenDetailActions.current.clearTokenDetail();
        } else {
          preparePreviewTokenDetail(resolvedItem);
        }

        // Clean existing token detail pages in tablet split view mode before pushing new one
        if (
          splitViewType !== ESplitViewType.UNKNOWN &&
          !options?.replaceCurrentDetail
        ) {
          navigation.switchTab(ETabRoutes.Discovery);
          appEventBus.emit(
            EAppEventBusNames.CleanTokenDetailInTabletDetailView,
            undefined,
          );
        }

        if (platformEnv.isNative) {
          await marketDetailShellPreloadPromise;
          if (navigationGenerationRef.current !== navigationGeneration) {
            return;
          }
        }
        if (stockId) {
          if (shouldReplaceCurrentDetail) {
            navigation.replace(ETabMarketRoutes.MarketStockDetail, params);
          } else {
            navigation.push(ETabMarketRoutes.MarketStockDetail, params);
          }
        } else if (shouldReplaceCurrentDetail) {
          navigation.replace(ETabMarketRoutes.MarketDetailV2, params);
        } else {
          navigation.push(ETabMarketRoutes.MarketDetailV2, params);
        }
      }
    },
    [
      currentRouteName,
      navigation,
      preparePreviewTokenDetail,
      options?.switchToMarketTabFirst,
      options?.from,
      options?.marketTokenCategory,
      options?.replaceCurrentDetail,
      options?.resolveMarketAsset,
      options?.showFavoriteButton,
      preloadLayout,
      splitViewType,
      tokenDetailActions,
    ],
  );

  return toMarketDetailPage;
}
