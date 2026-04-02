import { useEffect, useRef } from 'react';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * Hook to monitor login status changes and execute callback when user logs in
 * @param onLoginSuccess - Callback function to execute when user successfully logs in
 */
export function useLoginStatusChange(onLoginSuccess: () => void) {
  const [primeAtom] = usePrimePersistAtom();
  const prevLoginStatusRef = useRef<boolean | null>(null);

  useEffect(() => {
    const isCurrentlyLoggedIn =
      primeAtom.isLoggedIn && primeAtom.isLoggedInOnServer;

    // Detect login status change from false → true
    if (prevLoginStatusRef.current === false && isCurrentlyLoggedIn) {
      // User just logged in, execute callback
      onLoginSuccess();
    }

    // Update previous login status
    prevLoginStatusRef.current = isCurrentlyLoggedIn;
  }, [primeAtom.isLoggedIn, primeAtom.isLoggedInOnServer, onLoginSuccess]);
}
