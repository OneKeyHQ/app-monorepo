import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

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
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const resolvedAccountId = accountId ?? account?.id ?? '';
  const resolvedIndexedAccountId = indexedAccountId ?? indexedAccount?.id;

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
