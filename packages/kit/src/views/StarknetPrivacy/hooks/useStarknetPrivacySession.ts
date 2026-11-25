import { useEffect, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

// Key private reads to the unlock session so a late locked response cannot
// replace data fetched after credentials became available.
export function useStarknetPrivacySession({
  enabled = true,
  onLock,
  skipUnlock,
}: {
  enabled?: boolean;
  onLock: () => void;
  skipUnlock?: () => boolean;
}) {
  const [generation, setGeneration] = useState(0);
  const handlers = useRef({ enabled, onLock, skipUnlock });
  handlers.current = { enabled, onLock, skipUnlock };
  useEffect(() => {
    let locked: boolean | undefined;
    const handleLock = () => {
      if (locked === true) return;
      locked = true;
      handlers.current.onLock();
      setGeneration((value) => value + 1);
    };
    const handleUnlock = () => {
      if (locked === false) return;
      locked = false;
      if (handlers.current.enabled && !handlers.current.skipUnlock?.())
        setGeneration((value) => value + 1);
    };
    appEventBus.on(EAppEventBusNames.LockApp, handleLock);
    appEventBus.on(EAppEventBusNames.UnlockApp, handleUnlock);
    return () => {
      appEventBus.off(EAppEventBusNames.LockApp, handleLock);
      appEventBus.off(EAppEventBusNames.UnlockApp, handleUnlock);
    };
  }, []);
  return generation;
}
