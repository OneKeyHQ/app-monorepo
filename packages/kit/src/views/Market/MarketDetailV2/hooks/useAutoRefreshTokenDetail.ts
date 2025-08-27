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
      console.log('[PRICE_UPDATE] 🔄 useAutoRefreshTokenDetail starting:', {
        tokenAddress: data.tokenAddress || 'NATIVE',
        networkId: data.networkId,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Set the tokenAddress and networkId in jotai state
      tokenDetailActions.setTokenAddress(data.tokenAddress);
      tokenDetailActions.setNetworkId(data.networkId);

      console.log('[PRICE_UPDATE] 🌐 About to call fetchTokenDetail API:', {
        tokenAddress: data.tokenAddress || 'NATIVE',
        networkId: data.networkId,
      });

      // Always fetch token detail data to get complete token information
      // The K-line price priority logic is handled inside fetchTokenDetail
      const result = await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
      );

      console.log('[PRICE_UPDATE] ✅ fetchTokenDetail completed:', {
        tokenAddress: data.tokenAddress || 'NATIVE',
        finalPrice: result?.price,
        symbol: result?.symbol,
        hasLastUpdated: !!result?.lastUpdated,
      });
    },
    [data.tokenAddress, data.networkId, tokenDetailActions],
    {
      pollingInterval: 6000, // Changed from 5000 to 6000 to avoid race condition with K-line updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
}
