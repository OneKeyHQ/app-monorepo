import { useEffect, useRef } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

/**
 * Check if currently on Wallet main page (Home tab main page)
 * In webDappMode, we want to redirect from Wallet to Market tab on initial load
 * Should NOT redirect when on sub-pages like url-account
 */
function isCurrentlyOnWalletTab(): boolean {
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

    // Check if currently on Wallet tab (Home tab)
    const currentRoute = routes[currentIndex];
    const isOnHomeTab = currentRoute?.name === ETabRoutes.Home;

    if (!isOnHomeTab) {
      return false;
    }

    // Check if on the main wallet page, not on sub-routes like url-account
    const homeTabState = currentRoute?.state;
    if (!homeTabState) {
      // No sub-navigation state means we're on the main page
      return true;
    }

    const homeRoutes = homeTabState.routes || [];
    const homeCurrentIndex = homeTabState.index ?? 0;
    const currentHomeRoute = homeRoutes[homeCurrentIndex];

    // Only return true if on the main TabHome route, not on sub-pages
    const isOnMainWalletPage =
      currentHomeRoute?.name === ETabHomeRoutes.TabHome;

    return isOnMainWalletPage;
  } catch (error) {
    return false;
  }
}

/**
 * Auto redirect to Market tab on web platform when wallet page is loaded
 * Only executes when currently on Wallet tab
 */
export function useAutoRedirectToMarket() {
  const navigation = useAppNavigation();
  const hasRedirectedRef = useRef(false);
  const shouldRedirectToMarket = platformEnv.isWebDappMode;

  useEffect(() => {
    // Only redirect if currently on Wallet tab
    if (!isCurrentlyOnWalletTab()) {
      return;
    }

    if (shouldRedirectToMarket && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigation.switchTab(ETabRoutes.Market);
    }
  }, [navigation, shouldRedirectToMarket]);
}
