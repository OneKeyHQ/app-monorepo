import { useEffect } from 'react';

import { useReplaceToReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';

/**
 * Hook to redirect to appropriate ReferFriends page when user is not logged in
 * - Monitors login status in real-time using Jotai atom
 * - Redirects using replace method to prevent navigation back
 * - Uses unified navigation that checks login status
 */
export function useRedirectWhenNotLoggedIn(params?: {
  // Keeps the selected referral page tab across the redirect.
  tab?: IReferralPageTab;
  // The Perks tab does not need OneKey ID, so its host can pause the redirect.
  enabled?: boolean;
}) {
  const tab = params?.tab;
  const enabled = params?.enabled ?? true;
  const replaceToReferFriends = useReplaceToReferFriends();
  const [primeAtom] = usePrimePersistAtom();

  // Monitor login status changes in real-time
  useEffect(() => {
    const isLoggedIn = primeAtom.isLoggedIn && primeAtom.isLoggedInOnServer;

    if (enabled && !isLoggedIn) {
      void replaceToReferFriends(tab ? { tab } : undefined);
    }
  }, [
    enabled,
    primeAtom.isLoggedIn,
    primeAtom.isLoggedInOnServer,
    replaceToReferFriends,
    tab,
  ]);
}
