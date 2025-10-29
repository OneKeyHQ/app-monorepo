import { useEffect, useRef } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

/**
 * Check if currently on Home tab
 * In webDappMode, we want to redirect from Home to Market tab on initial load
 */
function isCurrentlyOnHomeTab(): boolean {
  try {
    const state = rootNavigationRef.current?.getRootState();
    if (!state?.routes) {
      return false;
    }

    // Find the main tab route
    const mainRoute = state.routes.find(
      (route) => route.name === ERootRoutes.Main,
    );
    if (!mainRoute?.state) {
      return false;
    }

    // Get the tab navigator state
    const tabState = mainRoute.state;
    const routes = tabState.routes || [];
    const currentIndex = tabState.index ?? 0;

    // Check if currently on Home tab
    const currentRoute = routes[currentIndex];
    const isOnHome = currentRoute?.name === ETabRoutes.Home;

    return isOnHome;
  } catch (error) {
    return false;
  }
}

/**
 * Auto redirect to Market tab on web platform when home page is loaded
 * Only executes when currently on Home tab
 */
export function useAutoRedirectToMarket() {
  const navigation = useAppNavigation();
  const hasRedirectedRef = useRef(false);
  const shouldRedirectToMarket = platformEnv.isWebDappMode;

  useEffect(() => {
    // Only redirect if currently on Home tab
    if (!isCurrentlyOnHomeTab()) {
      return;
    }

    if (shouldRedirectToMarket && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigation.switchTab(ETabRoutes.Market);
    }
  }, [navigation, shouldRedirectToMarket]);
}
