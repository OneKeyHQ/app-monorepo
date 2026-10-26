import { useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ESplitViewType,
  Toast,
  rootNavigationRef,
  useMedia,
  useSplitViewType,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { prewarmMarketTokenImages } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { buildMarketTokenDetailPreview } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPreview';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import {
  buildReplacedMarketDetailParams,
  prepareMarketDetailTabBarTransition,
} from '@onekeyhq/kit/src/views/Market/utils/marketDetailNavigation';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
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

// All entry rows navigate the same UI router. A newer selection must also
// supersede pending navigation started by a different hook instance.
const navigationGenerationRef = { current: 0 };

export function useToDetailPage(options?: IUseToDetailPageOptions) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabMarketParamList>>();
  const currentRouteName = useRoute().name;
  const tokenDetailActions = useTokenDetailActions();
  const splitViewType = useSplitViewType();
  const media = useMedia();
  const preloadLayout =
    media.gtLg && !platformEnv.isNative ? 'desktop' : 'mobile';

  useEffect(() => {
    void preloadMarketDetailV2Page();
  }, []);

  const buildPreviewTokenDetail = useCallback((item: IMarketToken) => {
    if (item.tokenDetailPreview) {
      return item.tokenDetailPreview;
    }

    const previewAddress = item.address ?? item.tokenAddress;

    if (
      (!previewAddress && !item.isNative) ||
      !item.name ||
      typeof item.decimals !== 'number'
    ) {
      return undefined;
    }

    const tokenDetailPreview = buildMarketTokenDetailPreview({
      ...(item as IMarketHomeToken),
      address: previewAddress,
      networkId: item.networkId,
      symbol: item.symbol,
      isNative: item.isNative,
    });

    return tokenDetailPreview;
  }, []);

  const toMarketDetailPage = useCallback(
    async (selectedItem: IMarketToken | IMarketAssetListItem) => {
      if (
        travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
        'travel-mode'
      ) {
        return;
      }
      const selectedToken = selectedItem as IMarketToken;
      const hasNoFetchTokenIdentity = Boolean(
        selectedToken.skipMarketDataFetch &&
        selectedToken.networkId &&
        (selectedToken.tokenAddress || selectedToken.isNative),
      );
      const isAssetEntry = Boolean(
        selectedItem.assetId && !hasNoFetchTokenIdentity,
      );
      const item: IMarketToken = isAssetEntry
        ? {
            assetId: selectedItem.assetId,
            symbol: selectedItem.symbol,
            name: selectedItem.name,
            networkId: '',
            tokenAddress: '',
            marketVariantId: selectedToken.marketVariantId,
            disableTrade: selectedToken.disableTrade,
            showFavoriteButton: selectedToken.showFavoriteButton,
          }
        : selectedToken;
      const navigationGeneration = navigationGenerationRef.current + 1;
      navigationGenerationRef.current = navigationGeneration;
      if (isAssetEntry && item.assetId) {
        void backgroundApiProxy.serviceMarket
          .fetchMarketAssetDetail({
            assetId: item.assetId,
            variantId: item.marketVariantId,
            currency: 'usd',
            autoHandleError: false,
            reuseInitialResult: true,
          })
          .catch(() => undefined);
      }
      const shouldResolveMarketAsset = Boolean(
        options?.resolveMarketAsset && !item.marketTokenId && !item.stock,
      );
      const resolvedItem = item;
      const marketTokenCategory = item.assetId
        ? MARKET_TOP_COINS_CATEGORY_ID
        : options?.marketTokenCategory;
      const stockId = resolveMarketStockId({
        stockId: resolvedItem.stockId,
      });
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
        ...(!isAssetEntry
          ? {
              tokenAddress: resolvedItem.tokenAddress,
              network: shortCode || resolvedItem.networkId,
            }
          : undefined),
        isNative: resolvedItem.isNative,
        from: options?.from,
        ...(resolvedItem.marketTokenId || resolvedItem.assetId
          ? {
              marketTokenId: resolvedItem.marketTokenId ?? resolvedItem.assetId,
            }
          : undefined),
        ...(resolvedItem.marketVariantId
          ? { marketVariantId: resolvedItem.marketVariantId }
          : undefined),
        ...(shouldResolveMarketAsset
          ? {
              resolveMarketAsset: true,
              marketTokenSymbol: resolvedItem.symbol,
            }
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
            tokenAddress: resolvedItem.tokenAddress,
            network: shortCode || resolvedItem.networkId,
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
      const navigationPreview = stockId
        ? undefined
        : buildPreviewTokenDetail(resolvedItem);
      if (navigationPreview) {
        prewarmMarketTokenImages(navigationPreview);
      }
      // Native keeps its existing eager initialization; other UIs initialize
      // shared preview state only after the destination route takes ownership.
      const routePreview = platformEnv.isNative
        ? resolvedItem.tokenDetailPreview
        : navigationPreview;
      const params =
        stockParams ??
        (routePreview
          ? {
              ...tokenParams,
              legacyTokenPreview: routePreview,
            }
          : tokenParams);
      const detailRouteName = stockId
        ? ETabMarketRoutes.MarketStockDetail
        : ETabMarketRoutes.MarketDetailV2;
      const shouldReplaceCurrentDetail = Boolean(
        options?.replaceCurrentDetail && currentRouteName !== detailRouteName,
      );
      const shouldUpdateCurrentDetail = Boolean(
        options?.replaceCurrentDetail && currentRouteName === detailRouteName,
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

        if (navigationGenerationRef.current !== navigationGeneration) {
          return;
        }
        if (stockId) {
          await backgroundApiProxy.serviceApp.openExtensionMarketStockDetail({
            stockId,
            tokenAddress: resolvedItem.tokenAddress,
            network: shortCode || resolvedItem.networkId,
            isNative: tokenParams.isNative,
            disableTrade: tokenParams.disableTrade,
            showFavoriteButton: tokenParams.showFavoriteButton,
            from: tokenParams.from || enterSource,
          });
        } else {
          try {
            await backgroundApiProxy.serviceApp.openExtensionMarketTokenDetail({
              ...tokenParams,
              from: tokenParams.from || enterSource,
              tokenDetailPreview: navigationPreview,
            });
          } catch {
            if (navigationGenerationRef.current !== navigationGeneration)
              return;
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              }),
            });
            return;
          }
        }
        if (navigationGenerationRef.current !== navigationGeneration) {
          return;
        }
        closeExtensionPopupAfterExpandTabOpen();
      } else if (options?.switchToMarketTabFirst) {
        if (stockId) {
          tokenDetailActions.current.prepareStockTokenDetail({
            tokenAddress: resolvedItem.tokenAddress,
            networkId: resolvedItem.networkId,
            isNative: resolvedItem.isNative,
          });
        } else if (platformEnv.isNative) {
          if (!navigationPreview) {
            tokenDetailActions.current.clearTokenDetail();
          } else {
            tokenDetailActions.current.prepareTokenDetailPreview(
              navigationPreview,
            );
          }
        }

        const targetTab = platformEnv.isNative
          ? ETabRoutes.Discovery
          : ETabRoutes.Market;

        await marketDetailShellPreloadPromise;
        if (navigationGenerationRef.current !== navigationGeneration) {
          return;
        }
        // Select the tab and detail together. Desktop preview state is initialized
        // by the destination route, never by the still-visible previous detail.
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: targetTab,
          params: {
            screen: detailRouteName,
            params,
          },
        });
        prepareMarketDetailTabBarTransition();
      } else {
        if (stockId) {
          tokenDetailActions.current.prepareStockTokenDetail({
            tokenAddress: resolvedItem.tokenAddress,
            networkId: resolvedItem.networkId,
            isNative: resolvedItem.isNative,
          });
        } else if (platformEnv.isNative) {
          if (navigationPreview) {
            tokenDetailActions.current.prepareTokenDetailPreview(
              navigationPreview,
            );
          } else {
            tokenDetailActions.current.clearTokenDetail();
          }
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

        if (platformEnv.isNative && !isAssetEntry) {
          await marketDetailShellPreloadPromise;
          if (navigationGenerationRef.current !== navigationGeneration) {
            return;
          }
        }
        if (shouldUpdateCurrentDetail) {
          navigation.setParams(
            buildReplacedMarketDetailParams(params as Record<string, unknown>),
          );
        } else if (stockId) {
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
        if (!shouldUpdateCurrentDetail) {
          prepareMarketDetailTabBarTransition();
        }
      }
    },
    [
      currentRouteName,
      intl,
      navigation,
      buildPreviewTokenDetail,
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
