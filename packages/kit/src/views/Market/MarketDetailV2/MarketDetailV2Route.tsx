import type { ComponentType, ReactNode } from 'react';
import { memo, useLayoutEffect, useRef } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

import {
  LazyLoadPage,
  LazyLoadPageBackdrop,
} from '../../../components/LazyLoadPage';

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
    const preloadedShell = getPreloadedMarketDetailV2Shell()?.default;
    const lastRenderedShell = useRef(preloadedShell);
    const hasRenderedAssetPreview = useRef(false);
    const isPendingAsset =
      'pendingMarketAsset' in params && Boolean(params.pendingMarketAsset);
    const shouldKeepComponentTypeStable =
      platformEnv.isDesktop ||
      platformEnv.isWeb ||
      isPendingAsset ||
      hasRenderedAssetPreview.current;
    // A pending asset can arrive after a native route has switched to the
    // preloaded shell. Preserve the component already mounted for that route.
    const PreloadedMarketDetailV2 = shouldKeepComponentTypeStable
      ? lastRenderedShell.current
      : preloadedShell;

    useLayoutEffect(() => {
      lastRenderedShell.current = PreloadedMarketDetailV2;
      if (isPendingAsset) {
        hasRenderedAssetPreview.current = true;
      }
    }, [PreloadedMarketDetailV2, isPendingAsset]);

    if (PreloadedMarketDetailV2) {
      const content = <PreloadedMarketDetailV2 {...props} />;
      // Rendering the preloaded shell directly also skips LazyLoadPage's
      // backdrop. Without it, the square stack card background shows around
      // the rounded corners of the desktop-mode BasicPage card.
      return platformEnv.isNative ? (
        content
      ) : (
        <LazyLoadPageBackdrop>{content}</LazyLoadPageBackdrop>
      );
    }

    return <LazyMarketDetailV2Route {...props} />;
  }

  return memo(MarketDetailV2Route) as ComponentType<IMarketDetailV2RouteProps>;
}
