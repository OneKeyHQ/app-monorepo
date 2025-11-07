import { useEffect } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

/**
 * Hook to redirect to ReferAFriend page when user is not logged in
 * - Monitors login status in real-time using Jotai atom
 * - Redirects using replace method to prevent navigation back
 */
export function useRedirectWhenNotLoggedIn() {
  const navigation = useAppNavigation();
  const [primeAtom] = usePrimePersistAtom();

  // Monitor login status changes in real-time
  useEffect(() => {
    const isLoggedIn = primeAtom.isLoggedIn && primeAtom.isLoggedInOnServer;

    if (!isLoggedIn) {
      navigation.replace(ETabReferFriendsRoutes.TabReferAFriend);
    }
  }, [primeAtom.isLoggedIn, primeAtom.isLoggedInOnServer, navigation]);
}
