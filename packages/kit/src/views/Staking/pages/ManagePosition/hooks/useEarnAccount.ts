import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

export const useEarnAccount = ({
  accountId,
  networkId,
  indexedAccountId,
}: {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
}) => {
  const { result: earnAccount, run: refreshAccount } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId,
        networkId,
        indexedAccountId,
        btcOnlyTaproot: true,
      }),
    [accountId, indexedAccountId, networkId],
  );

  return { earnAccount, refreshAccount };
};
