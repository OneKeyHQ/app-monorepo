import { useEffect } from 'react';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useReplaceToReferAFriend } from '../pages/ReferAFriend/hooks/useNavigateToReferAFriend';

/**
 * Hook to redirect to ReferAFriend page when user is not logged in
 * - Monitors login status in real-time using Jotai atom
 * - Redirects using replace method to prevent navigation back
 */
export function useRedirectWhenNotLoggedIn() {
  const replaceToReferAFriend = useReplaceToReferAFriend();
  const [primeAtom] = usePrimePersistAtom();

  // Monitor login status changes in real-time
  useEffect(() => {
    const isLoggedIn = primeAtom.isLoggedIn && primeAtom.isLoggedInOnServer;

    if (!isLoggedIn) {
      replaceToReferAFriend();
    }
  }, [
    primeAtom.isLoggedIn,
    primeAtom.isLoggedInOnServer,
    replaceToReferAFriend,
  ]);
}
