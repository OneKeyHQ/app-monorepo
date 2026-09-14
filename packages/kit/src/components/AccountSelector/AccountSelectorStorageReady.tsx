import type { ReactNode } from 'react';

import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

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
  const isMaskedRuntime =
    travelModeManager.getRuntimeEnvironmentSync().profile.persistence ===
    'masked';
  if (!waitForStorageReady || storageReady || isMaskedRuntime) {
    // TODO selectedAccount ready after storage init, but activeAccount not ready yet, may cause an additional refresh.
    return children;
  }
  return fallback;
}
