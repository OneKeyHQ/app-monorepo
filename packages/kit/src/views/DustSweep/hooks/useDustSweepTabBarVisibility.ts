import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';

import { rootNavigationRef } from '@onekeyhq/components';
import { getRootRoutersLength } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  createHideTabBarOwnerId,
  releaseHideTabBar,
  requestHideTabBar,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

export function useDustSweepTabBarVisibility(enabled: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!enabled) return undefined;

    const ownerId = createHideTabBarOwnerId('dust-sweep');
    let ownsRequest = false;
    let focusedRootDepth = 0;
    const syncVisibility = () => {
      const rootDepth = getRootRoutersLength();
      let shouldOwnRequest = ownsRequest;
      if (navigation.isFocused()) {
        if (!ownsRequest) focusedRootDepth = rootDepth;
        shouldOwnRequest = true;
      } else if (!platformEnv.isNative || rootDepth <= focusedRootDepth) {
        shouldOwnRequest = false;
      }

      // Keep the request while a native root modal covers this page, and
      // reconcile it when the modal closes or this page unmounts.
      if (shouldOwnRequest !== ownsRequest) {
        ownsRequest = shouldOwnRequest;
        if (ownsRequest) {
          requestHideTabBar(ownerId);
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
