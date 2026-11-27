import type { ComponentType, ReactNode } from 'react';
import { memo, useLayoutEffect, useRef } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadPageBackdrop,
} from '../../../components/LazyLoadPage';
import { finishMarketDetailTabBarTransition } from '../utils/marketDetailNavigation';

import { useMarketDetailTabBarVisibility } from './hooks/useMarketDetailTabBarVisibility';
import {
  getPreloadedMarketDetailV2Shell,
  loadMarketDetailV2Shell,
} from './utils/marketDetailPagePreload';

type IMarketDetailV2RouteProps = IPageScreenProps<
  ITabMarketParamList,
  ETabMarketRoutes.MarketDetailV2 | ETabMarketRoutes.MarketNativeDetail
>;

export function createMarketDetailV2Route(
  fallback?: ReactNode,
): ComponentType<IMarketDetailV2RouteProps> {
  const LazyMarketDetailV2Route = LazyLoadPage(
    loadMarketDetailV2Shell,
    undefined,
    undefined,
    fallback,
  );

  function MarketDetailV2Route(props: IMarketDetailV2RouteProps) {
    const { params } = props.route;
    const tabBarVisibilityManagedByRoute = Boolean(platformEnv.isNativeAndroid);
    useMarketDetailTabBarVisibility(
      tabBarVisibilityManagedByRoute,
      finishMarketDetailTabBarTransition,
    );
    const preloadedShell = getPreloadedMarketDetailV2Shell()?.default;
    const lastRenderedShell = useRef(preloadedShell);
    const hasRenderedAssetPreview = useRef(false);
    const openedFromNativeMarketList = useRef(
      platformEnv.isNative &&
        !platformEnv.isNativeIOSPad &&
        params.from === EEnterWay.MarketList,
    );
    const isPendingAsset =
      'pendingMarketAsset' in params && Boolean(params.pendingMarketAsset);
    const shouldKeepComponentTypeStable =
      platformEnv.isDesktop ||
      platformEnv.isWeb ||
      openedFromNativeMarketList.current ||
      isPendingAsset ||
      hasRenderedAssetPreview.current;
    // Keep an already mounted detail when preload or asset resolution finishes.
    const PreloadedMarketDetailV2 = shouldKeepComponentTypeStable
      ? lastRenderedShell.current
      : preloadedShell;

    useLayoutEffect(() => {
      lastRenderedShell.current = PreloadedMarketDetailV2;
      if (isPendingAsset) {
        hasRenderedAssetPreview.current = true;
      }
    }, [PreloadedMarketDetailV2, isPendingAsset]);

    const detailProps = { ...props, tabBarVisibilityManagedByRoute };
    if (PreloadedMarketDetailV2) {
      const content = <PreloadedMarketDetailV2 {...detailProps} />;
      // Rendering the preloaded shell directly also skips LazyLoadPage's
      // backdrop. Without it, the square stack card background shows around
      // the rounded corners of the desktop-mode BasicPage card.
      return platformEnv.isNative ? (
        content
      ) : (
        <LazyLoadPageBackdrop>{content}</LazyLoadPageBackdrop>
      );
    }

    return <LazyMarketDetailV2Route {...detailProps} />;
  }

  return memo(MarketDetailV2Route) as ComponentType<IMarketDetailV2RouteProps>;
}
