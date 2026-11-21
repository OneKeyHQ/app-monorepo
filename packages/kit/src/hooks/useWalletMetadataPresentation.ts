import { useEffect } from 'react';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

export function useWalletMetadataPresentation(
  walletId: string | undefined,
  canonicalWallet?: IDBWallet,
) {
  const shouldRead = !!walletId && !canonicalWallet;
  const { result, run } = usePromiseResult(
    async () => {
      if (!shouldRead || !walletId) return undefined;
      return backgroundApiProxy.serviceAccount.getWalletSafe({
        walletId,
        metadataForDisplay: true,
      });
    },
    [walletId, shouldRead],
    { initResult: undefined, revalidateOnFocus: true },
  );
  useEffect(() => {
    if (!shouldRead) return;
    appEventBus.on(EAppEventBusNames.WalletUpdate, run);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, run);
    };
  }, [shouldRead, run]);
  return canonicalWallet ?? (result?.id === walletId ? result : undefined);
}
