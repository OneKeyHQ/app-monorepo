import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

export const useBorrowRewards = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
}: {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
}) => {
  const {
    result: borrowRewards,
    run,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || !provider || !marketAddress || !accountId || !enabled) {
        return null;
      }

      const result = await backgroundApiProxy.serviceStaking.getBorrowRewards({
        networkId,
        provider,
        marketAddress,
        accountId,
      });
      return result;
    },
    [networkId, provider, marketAddress, accountId, enabled],
    {
      initResult: null,
    },
  );

  return {
    borrowRewards,
    isLoading,
    refresh: run,
  };
};
