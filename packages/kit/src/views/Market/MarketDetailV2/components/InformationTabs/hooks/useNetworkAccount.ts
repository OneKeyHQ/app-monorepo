import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { getSelectedDeriveTypeForNetwork } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/marketDeriveType';

export function useNetworkAccount(networkId: string) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [selectedDeriveType] = useSelectedDeriveTypeAtom();

  // Get network's default derive type
  const { result: networkDeriveTypeResult } = usePromiseResult(async () => {
    if (!networkId) return undefined;
    const deriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId,
      });
    return { networkId, deriveType };
  }, [networkId]);
  const networkDefaultDeriveType =
    networkDeriveTypeResult?.networkId === networkId
      ? networkDeriveTypeResult.deriveType
      : undefined;

  // Prioritize atom derive type (user selection) over network default derive type
  const effectiveDeriveType = useMemo(() => {
    return (
      getSelectedDeriveTypeForNetwork(selectedDeriveType, networkId) ??
      networkDefaultDeriveType ??
      activeAccount?.deriveType ??
      'default'
    );
  }, [
    selectedDeriveType,
    networkId,
    networkDefaultDeriveType,
    activeAccount?.deriveType,
  ]);

  const request = useMemo(
    () => ({
      accountId: activeAccount?.indexedAccount?.id
        ? undefined
        : activeAccount?.account?.id,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      networkId,
      deriveType: effectiveDeriveType,
    }),
    [
      activeAccount?.indexedAccount?.id,
      activeAccount?.account?.id,
      effectiveDeriveType,
      networkId,
    ],
  );
  const { result: accountResult } = usePromiseResult(async () => {
    const account = request.networkId
      ? await backgroundApiProxy.serviceAccount.getNetworkAccount(request)
      : null;
    return { request, account };
  }, [request]);
  // Hide the previous identity during render, before the async lookup starts.
  const networkAccount =
    accountResult?.request === request ? accountResult.account : undefined;

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
