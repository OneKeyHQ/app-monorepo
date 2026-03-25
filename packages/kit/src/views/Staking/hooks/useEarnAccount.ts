import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

type IUseEarnAccountParams = {
  networkId?: string;
  accountId?: string;
  indexedAccountId?: string;
  btcOnlyTaproot?: boolean;
};

export function useEarnAccount({
  networkId,
  accountId,
  indexedAccountId,
  btcOnlyTaproot = true,
}: IUseEarnAccountParams) {
  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  // For accountId: only use othersWalletAccountId (external/imported wallets).
  // NEVER use account?.id — it's network-specific and will mismatch in cross-network scenarios.
  const resolvedAccountId =
    accountId || selectedAccount.othersWalletAccountId || '';
  // For indexedAccountId: selectedAccount is available immediately from storage sync,
  // bypassing the async activeAccount resolution delay.
  const resolvedIndexedAccountId =
    indexedAccountId || selectedAccount.indexedAccountId || indexedAccount?.id;

  const {
    result: earnAccount,
    run: refreshAccount,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || (!resolvedAccountId && !resolvedIndexedAccountId)) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId: resolvedAccountId,
        networkId,
        indexedAccountId: resolvedIndexedAccountId,
        btcOnlyTaproot,
      });
    },
    [networkId, resolvedAccountId, resolvedIndexedAccountId, btcOnlyTaproot],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  return {
    earnAccount,
    isLoading,
    refreshAccount,
  };
}
