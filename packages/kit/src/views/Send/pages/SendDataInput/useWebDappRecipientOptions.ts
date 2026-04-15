import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IRecipientQuickSelectTab } from './recipientQuickSelectTabUtils';

export function useWebDappRecipientOptions({
  baseHiddenTabs,
}: { baseHiddenTabs?: IRecipientQuickSelectTab[] } = {}) {
  const { result: hasKeylessWallet = true } = usePromiseResult(async () => {
    if (!platformEnv.isWebDappMode) return true;
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      ignoreNonBackedUpWallets: true,
      nestedHiddenWallets: true,
    });
    return wallets.some((w) =>
      accountUtils.isKeylessWallet({ walletId: w.id }),
    );
  }, []);

  const hiddenTabs = useMemo<IRecipientQuickSelectTab[]>(() => {
    const base = baseHiddenTabs ?? [];
    if (!platformEnv.isWebDappMode) return base;
    return hasKeylessWallet
      ? [...base, 'addressBook']
      : [...base, 'addressBook', 'account'];
  }, [baseHiddenTabs, hasKeylessWallet]);

  return {
    hiddenTabs,
    keylessWalletsOnly: platformEnv.isWebDappMode,
  };
}
