import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

interface IUseBorrowHealthFactorParams {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
}

const POLLING_INTERVAL = 30 * 1000; // 30 seconds

export const useBorrowHealthFactor = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
}: IUseBorrowHealthFactorParams) => {
  const {
    result: healthFactorData,
    run,
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!networkId || !provider || !marketAddress || !accountId || !enabled) {
        return null;
      }

      const result =
        await backgroundApiProxy.serviceStaking.getBorrowHealthFactor({
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
      watchLoading: true,
      pollingInterval: POLLING_INTERVAL,
      // Fix: Ensure API responses update state even when page loses focus during request
      alwaysSetState: true,
    },
  );

  return {
    healthFactorData,
    isLoading,
    refresh: run,
  };
};
