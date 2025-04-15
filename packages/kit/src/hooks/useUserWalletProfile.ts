import { useEffect } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export function useUserWalletProfile() {
  const { result: isSoftwareWalletOnlyUser, run } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceAccountProfile.isSoftwareWalletOnlyUser(),
    [],
    {
      initResult: false,
      checkIsFocused: false,
    },
  );

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.WalletUpdate, run);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, run);
    };
  }, [run]);
  return { isSoftwareWalletOnlyUser };
}
