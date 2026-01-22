import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';

export function useNetworkAccountAddress(networkId: string) {
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
    const result =
      selectedDeriveType ??
      networkDefaultDeriveType ??
      activeAccount?.deriveType ??
      'default';
    console.log(
      '[MarketDeriveType] useNetworkAccountAddress effectiveDeriveType:',
      {
        selectedDeriveType,
        networkDefaultDeriveType,
        globalDeriveType: activeAccount?.deriveType,
        effectiveDeriveType: result,
      },
    );
    return result;
  }, [selectedDeriveType, networkDefaultDeriveType, activeAccount?.deriveType]);

  const { result: networkAccount } = usePromiseResult(async () => {
    if (!networkId) {
      return null;
    }

    const result = await backgroundApiProxy.serviceAccount.getNetworkAccount({
      accountId: activeAccount?.indexedAccount?.id
        ? undefined
        : activeAccount?.account?.id,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      networkId,
      deriveType: effectiveDeriveType,
    });

    console.log('[MarketDeriveType] useNetworkAccountAddress networkAccount:', {
      networkId,
      deriveType: effectiveDeriveType,
      address: result?.address,
    });

    return result;
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    effectiveDeriveType,
    networkId,
  ]);

  const accountAddress = networkAccount?.address;

  console.log(
    '[MarketDeriveType] useNetworkAccountAddress final accountAddress:',
    {
      accountAddress,
      networkId,
    },
  );

  return {
    accountAddress,
  };
}
