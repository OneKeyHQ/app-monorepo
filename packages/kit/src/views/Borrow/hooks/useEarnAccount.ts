import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function useEarnAccount({ networkId }: { networkId?: string }) {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const {
    result: earnAccount,
    run: refreshAccount,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!account && !indexedAccount && !networkId) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId: account?.id || '',
        networkId: networkId || '',
        indexedAccountId: indexedAccount?.id || '',
        btcOnlyTaproot: true,
      });
    },
    [account, indexedAccount, networkId],
    { watchLoading: true },
  );

  return {
    earnAccount,
    isLoading,
    refreshAccount,
  };
}
