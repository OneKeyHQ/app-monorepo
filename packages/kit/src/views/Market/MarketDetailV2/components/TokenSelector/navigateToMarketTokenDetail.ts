import { rootNavigationRef } from '@onekeyhq/components';
import type { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { chartPredictedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function navigateToMarketTokenDetail(
  token: {
    address: string;
    networkId: string;
    isNative?: boolean;
    symbol?: string;
  },
  opts: {
    tokenDetailActions: ReturnType<typeof useTokenDetailActions>;
    beforeNavigate?: () => void;
  },
) {
  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });

  // Seed the predicted symbol BEFORE changeActiveToken clears tokenDetail, so the
  // chart gate (useTokenDetail.chartSymbol) stays open through the switch — the
  // chart stays mounted and rides SYMBOL_CHANGE instead of unmounting/reloading.
  if ((platformEnv.isNative || platformEnv.isDesktop) && token.symbol) {
    void chartPredictedSymbolAtom.set({
      source: 'market',
      symbol: token.symbol,
      networkId: token.networkId,
      address: token.address,
    });
  }

  void opts.tokenDetailActions.current.changeActiveToken({
    tokenAddress: token.address,
    networkId: token.networkId,
    isNative: token.isNative ?? false,
  });

  opts.beforeNavigate?.();

  const targetTab = platformEnv.isNative
    ? ETabRoutes.Discovery
    : ETabRoutes.Market;
  const params = {
    tokenAddress: token.address,
    network: shortCode || token.networkId,
    isNative: token.isNative,
  };
  setTimeout(() => {
    rootNavigationRef.current?.navigate(ERootRoutes.Main, {
      screen: targetTab,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params,
      },
    });
  }, 100);
}
