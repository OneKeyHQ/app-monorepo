import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

interface IUseMarketDetailDataProps {
  tokenAddress: string;
  networkId: string;
}

export function useAutoRefreshTokenDetail(data: IUseMarketDetailDataProps) {
  const { current: tokenDetailActions } = useTokenDetailActions();

  return usePromiseResult(
    async () => {
      // Set the tokenAddress and networkId in jotai state
      tokenDetailActions.setTokenAddress(data.tokenAddress);
      tokenDetailActions.setNetworkId(data.networkId);

      // Fetch token detail data
      await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
      );
    },
    [data.tokenAddress, data.networkId, tokenDetailActions],
    {
      pollingInterval: 5000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
}
