import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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

  const { result } = usePromiseResult(
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

  return {
    isBotWallet,
    isBotWalletDeactivated: !!result,
  };
}
