import { useMemo } from 'react';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './useAppSelector';

export const useAppUnLockStatus = () => {
  const isPersistUnLock = useAppSelector((s) => s.status.isUnlock);
  return useMemo(
    () => isPersistUnLock && backgroundApiProxy.serviceApp.isMemoryUnLock,
    [isPersistUnLock],
  );
};
