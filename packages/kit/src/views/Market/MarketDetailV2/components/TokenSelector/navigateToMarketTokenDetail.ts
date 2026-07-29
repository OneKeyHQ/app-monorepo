import { rootNavigationRef } from '@onekeyhq/components';
import type { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { fetchMarketTokenDetailWithCache } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketTokenDetailInFlightRequest';
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
  prefetchMarketDetailV2FirstScreenTransactions,
  prepareMarketDetailV2KlineSource,
} from '../../utils/marketDetailPagePreload';

const NATIVE_MARKET_DETAIL_NAVIGATION_DEFER_MS = 100;

export interface IMarketTokenSelectionPrefetchTarget {
  address: string;
  networkId: string;
  currencyId: string;
  firstTradeTime?: number;
}

export function prefetchMarketTokenSelection(
  token: IMarketTokenSelectionPrefetchTarget,
) {
  prepareMarketDetailV2KlineSource({
    tokenAddress: token.address,
    networkId: token.networkId,
  });
  void fetchMarketTokenDetailWithCache({
    tokenAddress: token.address,
    networkId: token.networkId,
    currencyId: token.currencyId,
  }).catch(() => undefined);
  void prefetchMarketDetailV2FirstScreenKLine({
    tokenAddress: token.address,
    networkId: token.networkId,
    historyStartTime: token.firstTradeTime,
  }).catch(() => undefined);
  void prefetchMarketDetailV2FirstScreenTransactions({
    tokenAddress: token.address,
    networkId: token.networkId,
  }).catch(() => undefined);
}

export function navigateToMarketTokenDetail(
  token: { address: string; networkId: string; isNative?: boolean },
  opts: {
    tokenDetailActions: ReturnType<typeof useTokenDetailActions>;
    currencyId: string;
    beforeNavigate?: () => void;
    showFavoriteButton?: boolean;
    tokenDetailPreview?: IMarketTokenDetailPreview;
  },
) {
  prefetchMarketTokenSelection({
    ...token,
    currencyId: opts.currencyId,
    firstTradeTime: opts.tokenDetailPreview?.firstTradeTime,
  });
  prewarmMarketTokenDetailPreviewImages(opts.tokenDetailPreview);

  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });

  void opts.tokenDetailActions.current.changeActiveToken({
    tokenAddress: token.address,
    networkId: token.networkId,
    currencyId: opts.currencyId,
    historyStartTime: opts.tokenDetailPreview?.firstTradeTime,
    isNative: token.isNative ?? false,
    tokenDetailPreview: opts.tokenDetailPreview,
  });

  opts.beforeNavigate?.();

  const targetTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Market;
  const params = {
    tokenAddress: token.address,
    network: shortCode || token.networkId,
    isNative: token.isNative,
    ...(typeof opts.showFavoriteButton === 'boolean'
      ? { showFavoriteButton: opts.showFavoriteButton }
      : undefined),
  };
  const navigate = () => {
    rootNavigationRef.current?.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params,
      },
    });
  };

  if (platformEnv.isNative) {
    setTimeout(navigate, NATIVE_MARKET_DETAIL_NAVIGATION_DEFER_MS);
    return;
  }
  navigate();
}
