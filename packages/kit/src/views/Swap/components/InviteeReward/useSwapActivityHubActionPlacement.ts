import { useEffect, useMemo, useState } from 'react';

import { useAtomValue } from 'jotai';

import { swapTypeSwitchAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { getSwapActivityHubActionPlacement } from './utils';

interface IRouteSwapTypeState {
  routeSwapType?: ESwapTabSwitchType;
  pendingRouteSwapType?: ESwapTabSwitchType;
}

// The route tab and the swap store converge asynchronously (the mount-time
// switch in SwapHeaderContainer is delayed, and warm navigation goes through
// useSwapGlobal), so the route wins until the store catches up. Surfaces that
// already sit inside the swap provider read the store themselves and only need
// this reconciliation.
export function useSwapActivityHubPendingRouteSwapType({
  routeSwapType,
  swapTypeSwitch,
}: {
  routeSwapType?: ESwapTabSwitchType;
  swapTypeSwitch?: ESwapTabSwitchType;
}) {
  const [routeSwapTypeState, setRouteSwapTypeState] =
    useState<IRouteSwapTypeState>(() => ({
      routeSwapType,
      pendingRouteSwapType: routeSwapType,
    }));
  const pendingRouteSwapType =
    routeSwapTypeState.routeSwapType === routeSwapType
      ? routeSwapTypeState.pendingRouteSwapType
      : routeSwapType;

  useEffect(() => {
    if (routeSwapTypeState.routeSwapType !== routeSwapType) {
      setRouteSwapTypeState({
        routeSwapType,
        pendingRouteSwapType: routeSwapType,
      });
      return;
    }

    if (
      routeSwapTypeState.pendingRouteSwapType !== undefined &&
      swapTypeSwitch === routeSwapTypeState.pendingRouteSwapType
    ) {
      setRouteSwapTypeState({
        routeSwapType,
        pendingRouteSwapType: undefined,
      });
    }
  }, [routeSwapType, routeSwapTypeState, swapTypeSwitch]);

  return pendingRouteSwapType;
}

export function useSwapActivityHubActionPlacement({
  isDesktop,
  isMediumLayout,
  routeSwapType,
}: {
  isDesktop: boolean;
  isMediumLayout: boolean;
  routeSwapType?: ESwapTabSwitchType;
}) {
  const swapStore = useMemo(
    () =>
      jotaiContextStore.prepareStoreForImmediateUse({
        storeName: EJotaiContextStoreNames.swap,
      }),
    [],
  );
  const swapTypeSwitch = useAtomValue(swapTypeSwitchAtom(), {
    store: swapStore,
  });
  const pendingRouteSwapType = useSwapActivityHubPendingRouteSwapType({
    routeSwapType,
    swapTypeSwitch,
  });

  return getSwapActivityHubActionPlacement({
    isDesktop,
    isMediumLayout,
    pendingRouteSwapType,
    swapTypeSwitch,
  });
}
