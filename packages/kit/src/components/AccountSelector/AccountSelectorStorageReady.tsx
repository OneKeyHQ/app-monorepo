import type { ReactNode } from 'react';

import { useAccountSelectorStorageReadyAtom } from '../../states/jotai/contexts/accountSelector/atoms';

export function AccountSelectorStorageReady({
  children,
  fallback = null,
  waitForStorageReady = true,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
  waitForStorageReady?: boolean;
}) {
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  if (!waitForStorageReady || storageReady) {
    // TODO selectedAccount ready after storage init, but activeAccount not ready yet, may cause an additional refresh.
    return children;
  }
  return fallback;
}
