import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { getRootRoutersLength } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  createHideTabBarOwnerId,
  releaseHideTabBar,
  requestHideTabBar,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

import { finishMarketDetailTabBarTransition } from '../../utils/marketDetailNavigation';

export function useMarketDetailTabBarVisibility(enabled: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const ownerId = createHideTabBarOwnerId('market-detail');
    let ownsRequest = false;
    let focusedRootDepth = 0;
    const syncVisibility = () => {
      const rootDepth = getRootRoutersLength();
      let shouldOwnRequest = ownsRequest;
      if (navigation.isFocused()) {
        if (!ownsRequest) {
          focusedRootDepth = rootDepth;
        }
        shouldOwnRequest = true;
      } else if (!platformEnv.isNative || rootDepth <= focusedRootDepth) {
        shouldOwnRequest = false;
      }
      // A root modal covers the detail without leaving it. Keep its request
      // until the modal returns to this page or navigation leaves the detail.
      if (shouldOwnRequest !== ownsRequest) {
        ownsRequest = shouldOwnRequest;
        if (ownsRequest) {
          requestHideTabBar(ownerId);
          finishMarketDetailTabBarTransition();
        } else {
          releaseHideTabBar(ownerId);
        }
      }
    };
    const removeFocus = navigation.addListener('focus', syncVisibility);
    const removeBlur = navigation.addListener('blur', syncVisibility);
    const removeState = rootNavigationRef.current?.addListener(
      'state',
      syncVisibility,
    );
    syncVisibility();
    return () => {
      removeFocus();
      removeBlur();
      removeState?.();
      releaseHideTabBar(ownerId);
    };
  }, [enabled, navigation]);
}
