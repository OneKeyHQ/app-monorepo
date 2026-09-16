import type { ComponentType, ReactNode } from 'react';
import { memo, useRef } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

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
    // Keep the rendered component type stable for this route instance. A cold
    // lazy load may finish before the next param update; switching to the
    // direct component at that point would remount the entire detail screen.
    const preloadedMarketDetailV2Ref = useRef(
      getPreloadedMarketDetailV2Shell()?.default,
    );
    const PreloadedMarketDetailV2 = preloadedMarketDetailV2Ref.current;

    if (PreloadedMarketDetailV2) {
      return <PreloadedMarketDetailV2 {...props} />;
    }

    return <LazyMarketDetailV2Route {...props} />;
  }

  return memo(MarketDetailV2Route) as ComponentType<IMarketDetailV2RouteProps>;
}
