import { useCallback } from 'react';

import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

export function useOneKeyWalletDetection() {
  const getOneKeyConnectionInfo =
    useCallback((): IExternalConnectionInfo | null => {
      return null;
    }, []);

  return {
    isOneKeyInstalled: false,
    oneKeyProviderInfo: null,
    getOneKeyConnectionInfo,
  };
}
