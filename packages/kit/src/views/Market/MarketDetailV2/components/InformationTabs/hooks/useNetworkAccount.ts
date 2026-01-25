import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';

export function useNetworkAccount(networkId: string) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [selectedDeriveType] = useSelectedDeriveTypeAtom();

  // Get network's default derive type
  const { result: networkDefaultDeriveType } = usePromiseResult(async () => {
    if (!networkId) return undefined;
    return backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });
  }, [networkId]);

  // Prioritize atom derive type (user selection) over network default derive type
  const effectiveDeriveType = useMemo(() => {
    return (
      selectedDeriveType ??
      networkDefaultDeriveType ??
      activeAccount?.deriveType ??
      'default'
    );
  }, [selectedDeriveType, networkDefaultDeriveType, activeAccount?.deriveType]);

  const { result: networkAccount } = usePromiseResult(async () => {
    if (!networkId) {
      return null;
    }

    return backgroundApiProxy.serviceAccount.getNetworkAccount({
      accountId: activeAccount?.indexedAccount?.id
        ? undefined
        : activeAccount?.account?.id,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      networkId,
      deriveType: effectiveDeriveType,
    });
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    effectiveDeriveType,
    networkId,
  ]);

  // xpubSegwit only exists on BTC Taproot accounts, other UTXO chains use xpub
  const xpub = useMemo(() => {
    if (!networkAccount) return undefined;
    if ('xpubSegwit' in networkAccount && networkAccount.xpubSegwit) {
      return networkAccount.xpubSegwit;
    }
    if ('xpub' in networkAccount && networkAccount.xpub) {
      return networkAccount.xpub;
    }
    return undefined;
  }, [networkAccount]);

  return {
    networkAccount,
    accountAddress: networkAccount?.address,
    xpub,
  };
}
