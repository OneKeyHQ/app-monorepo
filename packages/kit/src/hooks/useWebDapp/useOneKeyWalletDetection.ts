import { useCallback, useMemo } from 'react';

import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

// ---------------------------------------------------------------------------
// React-Native stub for useOneKeyWalletDetection
//
// On RN there is no EIP-6963 support (no window.dispatchEvent / MIPD), so
// this file intentionally does NOT import `mipd`.  The full browser
// implementation lives in the `.web-only.ts` variant which is resolved by
// rspack / webpack for extension & web builds.
// ---------------------------------------------------------------------------

export function useOneKeyWalletDetection() {
  const isOneKeyExtWalletInstalled = !!globalThis.$onekey?.$private?.isOneKey;

  const getOneKeyConnectionInfo =
    useCallback((): IExternalConnectionInfo | null => {
      if (isOneKeyExtWalletInstalled) {
        return {
          evmInjected: {
            global: 'ethereum',
            name: 'OneKey Wallet',
          },
        };
      }

      return null;
    }, [isOneKeyExtWalletInstalled]);

  const isOneKeyInstalled = useMemo(
    () => isOneKeyExtWalletInstalled,
    [isOneKeyExtWalletInstalled],
  );

  const oneKeyProviderInfo = useMemo(() => {
    if (isOneKeyExtWalletInstalled) {
      return {
        name: 'OneKey Wallet',
        icon: '',
        rdns: 'injected',
        uuid: 'onekey-injected',
      };
    }

    return null;
  }, [isOneKeyExtWalletInstalled]);

  return {
    isOneKeyInstalled,
    oneKeyProviderInfo,
    getOneKeyConnectionInfo,
  };
}
