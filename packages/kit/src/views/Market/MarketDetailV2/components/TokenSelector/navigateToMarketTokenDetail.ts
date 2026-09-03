import { rootNavigationRef } from '@onekeyhq/components';
import type { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { prewarmMarketTokenDetailPreviewImages } from '../../utils/marketDetailImagePreload';
import {
  prefetchMarketDetailV2FirstScreenKLine,
  prepareMarketDetailV2KlineSource,
} from '../../utils/marketDetailPagePreload';
import { resolveMarketStockId } from '../../utils/resolveIsStockToken';

export function navigateToMarketTokenDetail(
  token: { address: string; networkId: string; isNative?: boolean },
  opts: {
    tokenDetailActions: ReturnType<typeof useTokenDetailActions>;
    beforeNavigate?: () => void;
    chartMode?: 'native' | 'tradingView';
    showFavoriteButton?: boolean;
    marketTokenCategory?: string;
    tokenDetailPreview?: IMarketTokenDetailPreview;
  },
) {
  prewarmMarketTokenDetailPreviewImages(opts.tokenDetailPreview);

  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });

  const stockId = resolveMarketStockId({
    stock: opts.tokenDetailPreview?.stock,
  });

  if (stockId) {
    opts.tokenDetailActions.current.clearTokenDetail();
  } else {
    if (opts.chartMode === 'tradingView') {
      prepareMarketDetailV2KlineSource({
        tokenAddress: token.address,
        networkId: token.networkId,
      });
      void prefetchMarketDetailV2FirstScreenKLine({
        tokenAddress: token.address,
        networkId: token.networkId,
        historyStartTime: opts.tokenDetailPreview?.firstTradeTime,
      }).catch(() => undefined);
    }
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
    tokenAddress: token.address,
    network: shortCode || token.networkId,
    isNative: token.isNative,
    ...(opts.marketTokenCategory
      ? { marketTokenCategory: opts.marketTokenCategory }
      : undefined),
    ...(opts.chartMode ? { chartMode: opts.chartMode } : undefined),
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
    rootNavigationRef.current?.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: routeName,
        params,
      },
    });
  }, 100);
}
