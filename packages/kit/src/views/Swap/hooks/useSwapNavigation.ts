import { rootNavigationRef } from '@onekeyhq/components';
import {
  EModalSwapRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import type { ISwapNavigationContext } from './swapNavigationUtils';

export const handleSwapNavigation = (
  callback: (params: ISwapNavigationContext) => void,
) => {
  const state = rootNavigationRef.current?.getRootState();
  if (state) {
    const tabIndex = state?.routes?.[0]?.state?.index || 0;
    const tabRoute = state?.routes?.[0]?.state?.routes?.[tabIndex];
    const isInSwapTab = tabRoute?.name === ETabRoutes.Swap;
    const tabSubRouteIndex = tabRoute?.state?.index ?? 0;
    const tabSubRouteName = tabRoute?.state?.routes?.[tabSubRouteIndex]?.name;
    const isInMarketDetail =
      tabSubRouteName === ETabMarketRoutes.MarketDetail ||
      tabSubRouteName === ETabMarketRoutes.MarketDetailV2 ||
      tabSubRouteName === ETabMarketRoutes.MarketNativeDetail;
    const hasModal = (state?.routes?.length || 0) > 1;
    let isHasSwapModal = false;
    let isSwapModalOnTheTop = false;

    let i = 1;
    const routes = state?.routes || [];
    while (i < routes.length) {
      const route = routes[i];
      const subRoutes = route?.state?.routes || [];
      for (let j = 0; j < subRoutes.length; j += 1) {
        const subRoute = subRoutes[j];
        const childRoutes = subRoute?.state?.routes || [];
        for (let k = 0; k < childRoutes.length; k += 1) {
          const childRoute = childRoutes[k];
          if (childRoute?.name === EModalSwapRoutes.SwapMainLand) {
            isHasSwapModal = true;
            isSwapModalOnTheTop =
              i === routes.length - 1 &&
              j === subRoutes.length - 1 &&
              k === childRoutes.length - 1;
            break;
          }
        }
      }

      if (isHasSwapModal) {
        break;
      }
      i += 1;
    }

    if (callback) {
      callback({
        isInSwapTab,
        isInMarketDetail,
        isHasSwapModal,
        isSwapModalOnTheTop,
        hasModal,
      });
    }
  }
};
