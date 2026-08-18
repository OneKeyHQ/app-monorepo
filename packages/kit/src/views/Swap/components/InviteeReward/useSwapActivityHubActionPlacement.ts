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

  return getSwapActivityHubActionPlacement({
    isDesktop,
    isMediumLayout,
    pendingRouteSwapType,
    swapTypeSwitch,
  });
}
