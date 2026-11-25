import { useCallback, useEffect, useRef } from 'react';

import { useRoute } from '@react-navigation/native';
import { debounce, omit } from 'lodash';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import type {
  IDexChartDisplayMode,
  IDexChartMode,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import {
  hasViewedMarketHomeInSession,
  markMarketDetailLeft,
  markMarketHomeViewed,
  resolveMarketHomeView,
  takeMarketDetailLeft,
  takeMarketHomeEntry,
} from '@onekeyhq/shared/src/logger/scopes/market/marketHomeEntry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

import {
  createMarketDetailVisitTimer,
  mergeMarketDetailAnalyticsAsset,
  resolveMarketDetailAnalyticsAsset,
} from '../utils/marketDetailAnalytics';
import {
  isInitialSectionConsumed,
  isPendingMarketAssetResolved,
  isSwapTokenLookupResolved,
} from '../utils/marketDetailNavigation';

import type {
  IMarketDetailAnalyticsAsset,
  IMarketDetailVisitTimer,
} from '../utils/marketDetailAnalytics';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

export type IMarketDetailVisitOptions = {
  // Whether the detail screen is the focused route and the app is unlocked.
  isFocused: boolean;
  // The params the detail screen renders, when they differ from its
  // navigation route (a legacy `/market/tokens/:token` link loads them).
  // Entry identity and `enterWay` always come from the navigation route.
  assetParams?: unknown;
  chartMode: IDexChartMode;
  chartDisplayMode: IDexChartDisplayMode;
  // Symbol of a token preview matching the route, when the route has none.
  fallbackSymbol?: string;
};

type IMarketDetailVisit = {
  enterWay: EEnterWay;
  // `detailKind` is missing until a pending Swap token lookup resolves it.
  asset: Partial<IMarketDetailAnalyticsAsset>;
  timer: IMarketDetailVisitTimer;
};

/**
 * Hook to track market page entry analytics
 * Records different entry ways: from route params, direct link, or others
 *
 * With `detailVisit`, each entry also reports the detail asset and chart
 * modes, and is paired with one `dexLeave` sent when the next entry starts
 * (asset switch) or the screen unmounts.
 */
export function useMarketEnterAnalytics(params?: {
  isLazyLoad?: boolean;
  detailVisit?: IMarketDetailVisitOptions;
}): void {
  const route = useRoute();
  const { isLazyLoad = false, detailVisit } = params ?? {};
  const isFirstRender = useRef(true);
  const previousParamsRef = useRef<unknown>(undefined);
  const isDetailVisitTracked = Boolean(detailVisit);
  const detailVisitRef = useRef(detailVisit);
  detailVisitRef.current = detailVisit;
  const visitRef = useRef<IMarketDetailVisit | undefined>(undefined);
  const isAppVisibleRef = useRef<boolean | undefined>(undefined);

  const isVisitActive = useCallback(() => {
    if (isAppVisibleRef.current === undefined) {
      isAppVisibleRef.current = getCurrentVisibilityState();
    }
    return Boolean(
      detailVisitRef.current?.isFocused && isAppVisibleRef.current,
    );
  }, []);

  const endVisit = useCallback(() => {
    const visit = visitRef.current;
    visitRef.current = undefined;
    if (!visit) return;
    const options = detailVisitRef.current;
    defaultLogger.dex.enter.dexLeave({
      enterWay: visit.enterWay,
      durationMs: visit.timer.getDurationMs(),
      ...visit.asset,
      ...(options
        ? {
            chartMode: options.chartMode,
            chartDisplayMode: options.chartDisplayMode,
          }
        : undefined),
    });
  }, []);

  useEffect(() => {
    const previousParams = previousParamsRef.current;
    previousParamsRef.current = route.params;
    const isSameEntry =
      // Clearing the one-shot `initialSection` rewrites params but is the
      // same entry; recording it again would double count it.
      isInitialSectionConsumed(previousParams, route.params) ||
      // Resolving `pendingMarketAsset` or the Swap token lookup rewrites the
      // asset params of the same tap; only a different entry identity is a
      // new entry.
      isPendingMarketAssetResolved(previousParams, route.params) ||
      isSwapTokenLookupResolved(previousParams, route.params);
    const options = detailVisitRef.current;
    const asset = options
      ? resolveMarketDetailAnalyticsAsset(options.assetParams ?? route.params, {
          fallbackSymbol: options.fallbackSymbol,
          isInAppEntry: Boolean(
            (route.params as { from?: unknown } | undefined)?.from,
          ),
        })
      : undefined;
    if (isSameEntry) {
      // The same visit goes on; keep what the resolved params add.
      if (visitRef.current && asset) {
        visitRef.current.asset = mergeMarketDetailAnalyticsAsset(
          visitRef.current.asset,
          asset,
        );
      }
      return;
    }
    if (isLazyLoad && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const routeParams = route.params as
      | {
          from?: EEnterWay;
          marketTokenCategory?: string;
          entryCategory?: string;
        }
      | undefined;

    let enterWay: EEnterWay;
    let marketTokenCategory: string | undefined;
    if (routeParams?.from) {
      // Entry from route params (e.g., from tab, search)
      enterWay = routeParams.from;
      // `entryCategory` is the list the row was pressed in (stocks,
      // watchlist). It wins over the route category, which top-coin assets
      // carry from any list; the reported field name stays
      // `marketTokenCategory`.
      marketTokenCategory =
        routeParams.entryCategory || routeParams.marketTokenCategory;
    } else if (platformEnv.isWeb && route?.path?.includes?.('/market')) {
      // Direct link entry on web platform
      enterWay = EEnterWay.Link;
    } else {
      // Other entry methods
      enterWay = EEnterWay.Others;
    }
    if (asset) {
      // A new entry on the same screen leaves the previous asset.
      endVisit();
    }
    // A Swap entry has no category until its token lookup resolves, so its
    // kind is unknown here; the paired leave reports the resolved kind.
    const isSwapTokenLookupPending = Boolean(
      (route.params as { swapTokenSymbol?: unknown } | undefined)
        ?.swapTokenSymbol,
    );
    const entryAsset: Partial<IMarketDetailAnalyticsAsset> | undefined =
      asset && isSwapTokenLookupPending
        ? omit(asset, 'detailKind')
        : asset;
    defaultLogger.dex.enter.dexEnter({
      enterWay,
      ...(marketTokenCategory ? { marketTokenCategory } : undefined),
      ...(options && entryAsset
        ? {
            ...entryAsset,
            chartMode: options.chartMode,
            chartDisplayMode: options.chartDisplayMode,
          }
        : undefined),
    });
    if (entryAsset) {
      visitRef.current = {
        enterWay,
        asset: entryAsset,
        timer: createMarketDetailVisitTimer({ isActive: isVisitActive() }),
      };
    }
  }, [endVisit, isLazyLoad, isVisitActive, route.params, route?.path]);

  const isFocused = detailVisit?.isFocused;
  useEffect(() => {
    visitRef.current?.timer.setActive(isVisitActive());
  }, [isFocused, isVisitActive]);

  useEffect(() => {
    if (!isDetailVisitTracked) return undefined;
    isAppVisibleRef.current = getCurrentVisibilityState();
    visitRef.current?.timer.setActive(isVisitActive());
    const unsubscribe = onVisibilityStateChange(
      (visible) => {
        isAppVisibleRef.current = visible;
        visitRef.current?.timer.setActive(isVisitActive());
      },
      // A desktop fullscreen toggle keeps the window focused; keep counting.
      { ignoreUnknownDesktopState: true },
    );
    return () => {
      unsubscribe();
      endVisit();
    };
  }, [endVisit, isDetailVisitTracked, isVisitActive]);
}

export function useMarketHomePageEnterAnalytics() {
  useEffect(() => {
    const listener = debounce((payload: { from: EEnterWay }) => {
      defaultLogger.dex.enter.dexEnter({
        enterWay: payload.from,
      });
    }, 50);
    appEventBus.on(EAppEventBusNames.MarketHomePageEnter, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.MarketHomePageEnter, listener);
    };
  }, []);
  useMarketEnterAnalytics({ isLazyLoad: true });
}

/**
 * Reports `marketHomeView` once per entry into the Market home. Unlike the
 * tab-press event above, it also covers programmatic tab switches (Discovery,
 * Wallet Home, deep links) and the first press before the home is mounted.
 */
export function useMarketHomeViewAnalytics(isFocused: boolean) {
  const wasFocusedRef = useRef(false);
  useEffect(() => {
    const becameFocused = isFocused && !wasFocusedRef.current;
    wasFocusedRef.current = isFocused;
    if (!becameFocused) return;
    const hasViewed = hasViewedMarketHomeInSession();
    const entrySource = resolveMarketHomeView({
      entrySource: takeMarketHomeEntry(),
      hasViewed,
      // Consumed on every focus gain so a stale flag never reaches a later one.
      isBackFromDetail: takeMarketDetailLeft(),
      isLandingPlatform: platformEnv.isWeb,
    });
    if (!entrySource) return;
    defaultLogger.market.home.marketHomeView({
      entrySource,
      isFirstView: !hasViewed,
    });
    markMarketHomeViewed();
  }, [isFocused]);
}

/**
 * Flags the removal of a Market detail route (back, pop to top, reset), so a
 * first home view revealed by it is reported as `detailBack`. Only a detail in
 * the Market tab stack reveals the Market home; the same screen in a Swap or
 * Market modal must not arm the flag.
 */
export function useMarketDetailLeaveAnalytics(
  navigation: Pick<NavigationProp<ParamListBase>, 'addListener'>,
  {
    isMarketTabDetail,
    isReturningToSwap,
  }: {
    isMarketTabDetail: boolean;
    // A Swap "view full data" detail goes back to Swap, not to the Market
    // home, until its trip has ended.
    isReturningToSwap?: () => boolean;
  },
) {
  const isReturningToSwapRef = useRef(isReturningToSwap);
  isReturningToSwapRef.current = isReturningToSwap;
  useEffect(() => {
    if (!isMarketTabDetail) return undefined;
    return navigation.addListener('beforeRemove', () => {
      if (isReturningToSwapRef.current?.()) return;
      markMarketDetailLeft();
    });
  }, [isMarketTabDetail, navigation]);
}
