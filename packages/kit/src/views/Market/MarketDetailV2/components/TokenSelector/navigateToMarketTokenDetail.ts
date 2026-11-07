import { rootNavigationRef } from '@onekeyhq/components';
import type { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import {
  type INavigationStateNode,
  findMarketTabStack,
  isReplaceableMarketDetailRouteName,
  openOrReplaceMarketDetailRoute,
  prepareMarketDetailTabBarTransition,
  replaceFocusedMarketDetailRoute,
} from '../../../utils/marketDetailNavigation';
import { prewarmMarketTokenDetailPreviewImages } from '../../utils/marketDetailImagePreload';
import { resolveMarketStockId } from '../../utils/resolveIsStockToken';

type ISelectedMarketToken = {
  address: string;
  networkId: string;
  isNative?: boolean;
  assetId?: string;
  marketVariantId?: string;
  stockId?: string;
};

type IMarketDetailRouteNavigation = {
  getCurrentRoute?: () =>
    | { name?: string; params?: Record<string, unknown> }
    | undefined;
  getRootState?: () => INavigationStateNode | undefined;
};

type IMarketDetailRouteIdentity = {
  marketTokenId?: unknown;
  marketVariantId?: unknown;
};

function getFocusedMarketDetailRouteParams():
  | IMarketDetailRouteIdentity
  | undefined {
  const navigation = rootNavigationRef.current as
    | IMarketDetailRouteNavigation
    | undefined;
  const currentRoute = navigation?.getCurrentRoute?.();
  // A selector overlay or another modal can be the focused route while the
  // Market detail page underneath still owns the preview state.
  if (
    isReplaceableMarketDetailRouteName(currentRoute?.name) &&
    currentRoute?.params
  ) {
    return currentRoute.params;
  }
  const stack = findMarketTabStack(navigation?.getRootState?.());
  const routes = stack?.routes ?? [];
  const stackRoute = routes[stack?.index ?? routes.length - 1];
  if (
    isReplaceableMarketDetailRouteName(stackRoute?.name) &&
    stackRoute?.params
  ) {
    return stackRoute.params;
  }
  return undefined;
}

function isSameMarketAssetRouteIdentity(
  token: ISelectedMarketToken,
  currentParams: IMarketDetailRouteIdentity | undefined,
) {
  return Boolean(
    token.assetId &&
    currentParams?.marketTokenId === token.assetId &&
    (currentParams.marketVariantId ?? undefined) ===
      (token.marketVariantId ?? undefined),
  );
}

export async function navigateToMarketTokenDetail(
  selectedToken: ISelectedMarketToken,
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
  const token = selectedToken;
  prewarmMarketTokenDetailPreviewImages(opts.tokenDetailPreview);

  const stockId = resolveMarketStockId({
    stockId: token.stockId,
  });
  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });
  const shouldResolveMarketAsset = Boolean(
    opts.resolveMarketAsset && !token.assetId && !stockId,
  );

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
  } else if (!token.assetId) {
    void opts.tokenDetailActions.current.changeActiveToken({
      tokenAddress: token.address,
      networkId: token.networkId,
      isNative: token.isNative ?? false,
      tokenDetailPreview: opts.tokenDetailPreview,
    });
  } else if (
    !isSameMarketAssetRouteIdentity(token, getFocusedMarketDetailRouteParams())
  ) {
    // The destination resolves its own variant: never keep the previously
    // opened token's preview, or its logo/symbol/address outlives the switch
    // while the new Asset is still loading.
    if (opts.tokenDetailPreview) {
      opts.tokenDetailActions.current.prepareTokenDetailPreview(
        opts.tokenDetailPreview,
      );
    } else {
      opts.tokenDetailActions.current.clearTokenDetail();
    }
  }

  const targetTab = ETabRoutes.Market;
  const tokenParams = {
    ...(token.assetId
      ? {
          marketTokenId: token.assetId,
          ...(token.marketVariantId
            ? { marketVariantId: token.marketVariantId }
            : undefined),
          marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
        }
      : {
          tokenAddress: token.address,
          network: shortCode || token.networkId,
          isNative: token.isNative,
        }),
    ...(shouldResolveMarketAsset
      ? {
          resolveMarketAsset: true,
          marketTokenSymbol: opts.tokenDetailPreview?.symbol,
          legacyTokenPreview: opts.tokenDetailPreview,
        }
      : undefined),
    ...(!shouldResolveMarketAsset &&
    !stockId &&
    !token.assetId &&
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
