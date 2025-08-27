import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

interface IUseMarketDetailDataProps {
  tokenAddress: string;
  networkId: string;
}

export function useAutoRefreshTokenDetail(data: IUseMarketDetailDataProps) {
  const { current: tokenDetailActions } = useTokenDetailActions();
  const [tokenDetail] = useTokenDetailAtom();

  return usePromiseResult(
    async () => {
      // Set the tokenAddress and networkId in jotai state
      tokenDetailActions.setTokenAddress(data.tokenAddress);
      tokenDetailActions.setNetworkId(data.networkId);

      // Check if we have recent K-line updated price to avoid overwriting it
      const hasRecentKLinePrice = tokenDetail?.lastUpdated;
      const timeSinceKLineUpdate = hasRecentKLinePrice && tokenDetail.lastUpdated 
        ? Date.now() - tokenDetail.lastUpdated 
        : Infinity;
      
      // If K-line price was updated within the last 10 seconds, skip API call to preserve K-line price
      const shouldSkipApiCall = hasRecentKLinePrice && timeSinceKLineUpdate < 10000;
      
      if (!shouldSkipApiCall) {
        // Fetch token detail data only if no recent K-line price
        await tokenDetailActions.fetchTokenDetail(
          data.tokenAddress,
          data.networkId,
        );
      }
    },
    [data.tokenAddress, data.networkId, tokenDetailActions, tokenDetail?.lastUpdated],
    {
      pollingInterval: 6000, // Changed from 5000 to 6000 to avoid race condition with K-line updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
}
