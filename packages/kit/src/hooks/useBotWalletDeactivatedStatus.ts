import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export interface IBotWalletDeactivatedStatus {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}

export function useBotWalletDeactivatedStatus({
  walletId,
}: {
  walletId?: string;
}): IBotWalletDeactivatedStatus {
  const isBotWallet = useMemo(
    () => accountUtils.isBotWallet({ walletId }),
    [walletId],
  );

  const { result, run } = usePromiseResult(
    async () => {
      if (!walletId || !isBotWallet) {
        return false;
      }
      return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
        walletId,
      });
    },
    [walletId, isBotWallet],
    {
      checkIsFocused: false,
    },
  );

  // Refresh when bot wallet metadata changes. ServiceAccount.deactivate /
  // reactivateBotWallet emit WalletUpdate (debounced) via
  // scheduleWalletUpdateForBotMetadata, so subscribing here keeps every
  // dependent UI in sync without requiring a page refresh.
  useEffect(() => {
    if (!isBotWallet) return;
    appEventBus.on(EAppEventBusNames.WalletUpdate, run);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, run);
    };
  }, [isBotWallet, run]);

  return {
    isBotWallet,
    isBotWalletDeactivated: !!result,
  };
}
