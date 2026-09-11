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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { prewarmMarketTokenDetailPreviewImages } from '../../utils/marketDetailImagePreload';
import { resolveMarketStockId } from '../../utils/resolveIsStockToken';

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
        'prepareStockTokenDetail' | 'changeActiveToken'
      > &
        Partial<
          Pick<
            ReturnType<typeof useTokenDetailActions>['current'],
            'prepareTokenDetailPreview'
          >
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
    try {
      const { selectedVariant } =
        await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
          assetId: token.assetId,
          currency: 'usd',
          autoHandleError: false,
        });
      if (!isCurrentRequest()) return;
      token = {
        ...token,
        address: selectedVariant.tokenAddress,
        networkId: selectedVariant.networkId,
        isNative: selectedVariant.isNative,
      };
      marketVariantId = selectedVariant.variantId;
    } catch {
      if (isCurrentRequest()) opts.onError?.();
      return;
    }
  }
  prewarmMarketTokenDetailPreviewImages(opts.tokenDetailPreview);

  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });

  const stockId = resolveMarketStockId({
    stockId: token.stockId,
    name: opts.tokenDetailPreview?.name,
    symbol: opts.tokenDetailPreview?.symbol,
    stock: opts.tokenDetailPreview?.stock,
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
    opts.tokenDetailActions.current.prepareTokenDetailPreview?.(
      opts.tokenDetailPreview,
    );
  } else {
    void opts.tokenDetailActions.current.changeActiveToken({
      tokenAddress: token.address,
      networkId: token.networkId,
      isNative: token.isNative ?? false,
      tokenDetailPreview: opts.tokenDetailPreview,
    });
  }

  opts.beforeNavigate?.();

  const targetTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Market;
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
  setTimeout(() => {
    if (!isCurrentRequest()) return;
    rootNavigationRef.current?.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: routeName,
        params,
      },
    });
  }, 100);
}
