import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

export function useNetworkAccountAddress(networkId: string) {
  const { activeAccount } = useActiveAccount({ num: 0 });

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
      deriveType: activeAccount.deriveType ?? 'default',
    });
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount?.deriveType,
    networkId,
  ]);

  return {
    accountAddress: networkAccount?.address,
  };
}
