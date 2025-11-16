import { useEffect } from 'react';

import { useReplaceToReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * Hook to redirect to appropriate ReferFriends page when user is not logged in
 * - Monitors login status in real-time using Jotai atom
 * - Redirects using replace method to prevent navigation back
 * - Uses unified navigation that checks login status
 */
export function useRedirectWhenNotLoggedIn() {
  const replaceToReferFriends = useReplaceToReferFriends();
  const [primeAtom] = usePrimePersistAtom();

  // Monitor login status changes in real-time
  useEffect(() => {
    const isLoggedIn = primeAtom.isLoggedIn && primeAtom.isLoggedInOnServer;

    if (!isLoggedIn) {
      void replaceToReferFriends();
    }
  }, [
    primeAtom.isLoggedIn,
    primeAtom.isLoggedInOnServer,
    replaceToReferFriends,
  ]);
}
