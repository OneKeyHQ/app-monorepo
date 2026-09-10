import { useEffect, useState } from 'react';

import NetInfo from '@react-native-community/netinfo';

// Metered-connection check for the privacy-chain sync gate.
//
// Subscribing rather than calling the `useNetInfo` hook keeps the failure
// mode explicit: unknown remains undefined so the background runtime does not
// mistake startup or a missing native module for confirmed Wi-Fi.
export function useIsCellularNetwork(): boolean | undefined {
  const [isCellular, setIsCellular] = useState<boolean | undefined>();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = NetInfo.addEventListener((state) => {
        const expensive = state.details as
          | { isConnectionExpensive?: boolean }
          | undefined;
        setIsCellular(
          state.type === 'unknown'
            ? undefined
            : state.type === 'cellular' ||
                expensive?.isConnectionExpensive === true,
        );
      });
    } catch (e) {
      console.error('[privacy-chain] NetInfo unavailable', e);
      setIsCellular(undefined);
    }
    return () => unsubscribe?.();
  }, []);

  return isCellular;
}
