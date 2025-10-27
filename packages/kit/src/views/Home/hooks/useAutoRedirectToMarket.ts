import { useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { isCurrentlyInUrlAccountPage } from '../pages/urlAccount/urlAccountUtils';

/**
 * Auto redirect to Market tab on web platform when home page is loaded
 */
export function useAutoRedirectToMarket() {
  const navigation = useAppNavigation();
  const hasRedirectedRef = useRef(false);
  const shouldRedirectToMarket = platformEnv.isWebDappMode;

  useEffect(() => {
    // Don't redirect if currently on URL account page
    if (isCurrentlyInUrlAccountPage()) {
      return;
    }

    if (shouldRedirectToMarket && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigation.switchTab(ETabRoutes.Market);
    }
  }, [navigation, shouldRedirectToMarket]);
}
