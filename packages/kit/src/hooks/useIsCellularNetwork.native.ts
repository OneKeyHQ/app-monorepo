import { useEffect, useState } from 'react';

import NetInfo from '@react-native-community/netinfo';

// Unknown stays undefined so startup or a missing native module is never
// mistaken for confirmed Wi-Fi.
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
