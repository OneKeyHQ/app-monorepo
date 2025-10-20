import { useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

/**
 * Auto redirect to Market tab on web platform when home page is loaded
 */
export function useAutoRedirectToMarket() {
  const navigation = useAppNavigation();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (platformEnv.isWeb && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigation.switchTab(ETabRoutes.Market);
    }
  }, [navigation]);
}
