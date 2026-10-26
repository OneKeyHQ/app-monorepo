import { useCallback, useEffect, useRef } from 'react';

import {
  CommonActions,
  useNavigation as useReactNavigation,
  useRoute,
} from '@react-navigation/native';

import { switchTab, useSplitSubView } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  isInitialSectionConsumed,
  isSwapStockTripEnded,
  resolveMarketDetailBackAction,
  runAfterNextFrame,
  setSwapStockTripEnded,
} from '../../utils/marketDetailNavigation';

import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Swap's "view full data" switched tabs to reach this detail. Every back that
 * pops it (the desktop title bar's shared header and the in-page back button
 * alike) finishes the trip to the Swap tab the user left. Other removals (tab
 * re-press, resets, stock switches) keep their behavior.
 *
 * The trip is one-shot: leaving the Market tab any other way (sidebar, tab
 * bar) ends it, so a later visit's back stays in Market. Tracked outside the
 * params, whose changes would re-record the market entry analytics. A new
 * entry restarts it; consuming `initialSection` does not.
 */
export function useSwapStockBackTrip({
  navigation,
  params,
  routeKey,
  isFromSwapStock,
  isChartFullscreen,
}: {
  navigation: Pick<NavigationProp<ParamListBase>, 'addListener' | 'dispatch'>;
  params: unknown;
  routeKey: string;
  isFromSwapStock: boolean;
  isChartFullscreen: boolean;
}) {
  // The tab listener is registered once, so it reads these through refs.
  const isFromSwapStockRef = useRef(isFromSwapStock);
  isFromSwapStockRef.current = isFromSwapStock;
  const routeKeyRef = useRef(routeKey);
  routeKeyRef.current = routeKey;
  const isChartFullscreenRef = useRef(isChartFullscreen);
  isChartFullscreenRef.current = isChartFullscreen;
  const isReturningToSwapRef = useRef(false);
  const hasShownMarketTabRef = useRef(false);
  const previousParamsRef = useRef(params);
  useEffect(() => {
    const previousParams = previousParamsRef.current;
    previousParamsRef.current = params;
    if (
      previousParams !== params &&
      isInitialSectionConsumed(previousParams, params)
    ) {
      return;
    }
    hasShownMarketTabRef.current = false;
    isReturningToSwapRef.current = false;
    setSwapStockTripEnded(routeKey, false);
  }, [params, routeKey]);
  useEffect(() => () => setSwapStockTripEnded(routeKey, false), [routeKey]);
  useListenTabFocusState(ETabRoutes.Market, (isFocus) => {
    if (!isFromSwapStockRef.current) return;
    if (isFocus) {
      hasShownMarketTabRef.current = true;
    } else if (hasShownMarketTabRef.current && !isReturningToSwapRef.current) {
      setSwapStockTripEnded(routeKeyRef.current, true);
    }
  });
  useEffect(() => {
    if (!isFromSwapStock) return;
    return navigation.addListener('beforeRemove', (event) => {
      const { action } = event.data;
      if (
        isReturningToSwapRef.current ||
        isSwapStockTripEnded(routeKey) ||
        isChartFullscreenRef.current ||
        (action.type !== 'GO_BACK' && action.type !== 'POP')
      ) {
        return;
      }
      // Switch tabs before the pop: popping first shows the Market list for
      // a frame before Swap comes back.
      event.preventDefault();
      isReturningToSwapRef.current = true;
      switchTab(ETabRoutes.Swap);
      runAfterNextFrame(() => navigation.dispatch(action));
    });
  }, [isFromSwapStock, navigation, routeKey]);
}

export function useMarketDetailBackNavigation() {
  const navigation = useAppNavigation();
  const reactNavigation = useReactNavigation();
  const route = useRoute();
  const params = route.params as { from?: EEnterWay } | undefined;
  const isTabletDetailView = useSplitSubView();

  const handleBackPress = useCallback(() => {
    const state = reactNavigation.getState();
    const from =
      params?.from === EEnterWay.SwapStock && isSwapStockTripEnded(route.key)
        ? undefined
        : params?.from;
    const action = resolveMarketDetailBackAction({
      isTabletDetailView,
      isNative: Boolean(platformEnv.isNative),
      from,
      routes: state?.routes,
      index: state?.index,
    });

    if (action.type === 'pop') {
      navigation.pop();
      return;
    }
    if (action.type === 'popAndSwitchMarket') {
      navigation.pop();
      navigation.switchTab(ETabRoutes.Market);
      return;
    }
    if (action.type === 'resetAndSwitchSwap') {
      // Switch first so the Market list never shows for a frame.
      navigation.switchTab(ETabRoutes.Swap);
      runAfterNextFrame(() =>
        reactNavigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: ETabMarketRoutes.TabMarket }],
          }),
        ),
      );
      return;
    }
    if (action.type === 'popToTop') {
      navigation.popToTop();
      return;
    }

    reactNavigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: action.name,
            ...(action.params ? { params: action.params } : {}),
          },
        ],
      }),
    );
  }, [params, route.key, reactNavigation, navigation, isTabletDetailView]);

  return { handleBackPress };
}
