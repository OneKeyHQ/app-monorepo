import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { requireMarketAssetVariant } from '@onekeyhq/shared/src/utils/marketAssetVariant';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import {
  isFocusedMarketDetailRouteName,
  openOrReplaceMarketDetailRoute,
  prepareMarketDetailTabBarTransition,
  replaceFocusedMarketDetailRoute,
} from '../../../utils/marketDetailNavigation';
import { prewarmMarketTokenDetailPreviewImages } from '../../utils/marketDetailImagePreload';
import { resolveMarketStockId } from '../../utils/resolveIsStockToken';
import { resolveMarketAssetRouteIdentity } from '../../utils/resolveMarketAssetRouteIdentity';

export async function navigateToMarketTokenDetail(
  selectedToken: {
    address: string;
    networkId: string;
    isNative?: boolean;
    assetId?: string;
    stockId?: string;
  },
  opts: {
    tokenDetailActions: {
      current: Pick<
        ReturnType<typeof useTokenDetailActions>['current'],
        | 'prepareStockTokenDetail'
        | 'changeActiveToken'
        | 'prepareTokenDetailPreview'
        | 'clearTokenDetail'
      >;
    };
    beforeNavigate?: () => void;
    isCurrentRequest?: () => boolean;
    onError?: () => void;
    showFavoriteButton?: boolean;
    marketTokenCategory?: string;
    resolveMarketAsset?: boolean;
    tokenDetailPreview?: IMarketTokenDetailPreview;
  },
) {
  const isCurrentRequest = opts.isCurrentRequest ?? (() => true);
  let token = selectedToken;
  let marketVariantId: string | undefined;
  if (token.assetId) {
    let assetDetailFetched = false;
    try {
      const detail =
        await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
          assetId: token.assetId,
          currency: 'usd',
          autoHandleError: false,
        });
      assetDetailFetched = true;
      if (!isCurrentRequest()) return;
      const selectedVariant = requireMarketAssetVariant({
        detail,
        networkId: token.networkId,
        tokenAddress: token.address,
        isNative: token.isNative,
      });
      token = {
        ...token,
        address: selectedVariant.tokenAddress,
        networkId: selectedVariant.networkId,
        isNative: selectedVariant.isNative,
      };
      marketVariantId = selectedVariant.variantId;
    } catch {
      if (!isCurrentRequest()) return;
      if (!assetDetailFetched && token.networkId) {
        // Preserve the searched chain when the optional asset lookup is offline.
        token = { ...token, assetId: undefined };
      } else {
        opts.onError?.();
        return;
      }
    }
  }
  prewarmMarketTokenDetailPreviewImages(opts.tokenDetailPreview);

  const stockId = resolveMarketStockId({
    stockId: token.stockId,
  });
  let shouldResolveMarketAsset = Boolean(
    opts.resolveMarketAsset && !token.assetId && !stockId,
  );
  let shouldDeferTokenInitialization = false;
  if (
    shouldResolveMarketAsset &&
    !platformEnv.isNative &&
    opts.tokenDetailPreview?.symbol &&
    isFocusedMarketDetailRouteName(
      rootNavigationRef.current?.getCurrentRoute()?.name,
    )
  ) {
    shouldDeferTokenInitialization = true;
    const identity = await resolveMarketAssetRouteIdentity({
      networkId: token.networkId,
      tokenAddress: token.address,
      symbol: opts.tokenDetailPreview.symbol,
      isNative: token.isNative,
    });
    if (!isCurrentRequest()) return;
    if (identity) {
      token = {
        ...token,
        assetId: identity.marketTokenId,
        address: identity.tokenAddress,
        networkId: identity.networkId,
        isNative: identity.isNative,
      };
      marketVariantId = identity.marketVariantId;
      shouldResolveMarketAsset = false;
    }
  }
  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });

  // Desktop preflight keeps the previous detail visible; the destination route
  // initializes shared state after taking ownership.
  if (!shouldDeferTokenInitialization) {
    if (stockId) {
      opts.tokenDetailActions.current.prepareStockTokenDetail({
        tokenAddress: token.address,
        networkId: token.networkId,
        isNative: token.isNative,
      });
    } else if (shouldResolveMarketAsset) {
      if (opts.tokenDetailPreview) {
        opts.tokenDetailActions.current.prepareTokenDetailPreview(
          opts.tokenDetailPreview,
        );
      } else {
        opts.tokenDetailActions.current.clearTokenDetail();
      }
    } else {
      void opts.tokenDetailActions.current.changeActiveToken({
        tokenAddress: token.address,
        networkId: token.networkId,
        isNative: token.isNative ?? false,
        tokenDetailPreview: opts.tokenDetailPreview,
      });
    }
  }

  const targetTab = ETabRoutes.Market;
  const tokenParams = {
    ...(token.assetId
      ? {
          marketTokenId: token.assetId,
          marketVariantId,
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        }
      : undefined),
    tokenAddress: token.address,
    network: shortCode || token.networkId,
    isNative: token.isNative,
    ...(shouldResolveMarketAsset
      ? {
          resolveMarketAsset: true,
          marketTokenSymbol: opts.tokenDetailPreview?.symbol,
          legacyTokenPreview: opts.tokenDetailPreview,
        }
      : undefined),
    ...(!shouldResolveMarketAsset &&
    !stockId &&
    opts.tokenDetailPreview &&
    (platformEnv.isDesktop || platformEnv.isWeb)
      ? { legacyTokenPreview: opts.tokenDetailPreview }
      : undefined),
    ...(!token.assetId && opts.marketTokenCategory
      ? { marketTokenCategory: opts.marketTokenCategory }
      : undefined),
    ...(typeof opts.showFavoriteButton === 'boolean'
      ? { showFavoriteButton: opts.showFavoriteButton }
      : undefined),
  };
  const params = stockId
    ? {
        stockId,
        ...tokenParams,
      }
    : tokenParams;
  const routeName = stockId
    ? ETabMarketRoutes.MarketStockDetail
    : ETabMarketRoutes.MarketDetailV2;
  if (!isCurrentRequest()) {
    return;
  }
  // Update the already-open detail first, while a selector overlay still
  // leaves the tab stack visible in getRootState(). Root-navigating
  // Discovery/Market otherwise stacks another detail page.
  const replacedCurrentDetail = openOrReplaceMarketDetailRoute({
    routeName,
    params: params as Record<string, unknown>,
  });
  opts.beforeNavigate?.();
  if (replacedCurrentDetail) {
    return;
  }
  setTimeout(() => {
    if (!isCurrentRequest()) return;
    // After the selector overlay closes, nested tab state is often missing
    // from getRootState(). Updating the focused detail avoids pushing another
    // page onto Discovery/Market.
    if (
      replaceFocusedMarketDetailRoute({
        routeName,
        params: params as Record<string, unknown>,
      })
    ) {
      return;
    }
    prepareMarketDetailTabBarTransition();
    rootNavigationRef.current?.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: routeName,
        params,
      },
    });
  }, 100);
}
