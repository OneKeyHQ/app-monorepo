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

export function navigateToMarketTokenDetail(
  token: { address: string; networkId: string; isNative?: boolean },
  opts: {
    tokenDetailActions: ReturnType<typeof useTokenDetailActions>;
    beforeNavigate?: () => void;
    showFavoriteButton?: boolean;
    tokenDetailPreview?: IMarketTokenDetailPreview;
  },
) {
  prewarmMarketTokenDetailPreviewImages(opts.tokenDetailPreview);

  const shortCode = networkUtils.getNetworkShortCode({
    networkId: token.networkId,
  });

  void opts.tokenDetailActions.current.changeActiveToken({
    tokenAddress: token.address,
    networkId: token.networkId,
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
