import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import {
  formatLiquidityValue,
  getDefaultNetworkId,
  getMinLiquidity,
  getNetworkList,
  getRefreshInterval,
} from './utils';

/**
 * Hook to fetch and manage market basic configuration
 * Provides default network, recommended tokens, and other market settings
 */
export function useMarketBasicConfig() {
  const { result, isLoading } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig();
      const configData = response?.data;

      if (!configData) {
        return null;
      }

      // Process all data in one place
      const defaultNetworkId = getDefaultNetworkId(configData);
      const recommendedTokens = configData.recommendTokens;
      const minLiquidity = getMinLiquidity(configData);
      const refreshInterval = getRefreshInterval(configData);
      const formattedMinLiquidity = formatLiquidityValue(minLiquidity);
      const networkList = getNetworkList(configData);

      return {
        // Raw config data
        basicConfig: configData,
        // Processed data
        defaultNetworkId,
        recommendedTokens,
        minLiquidity,
        refreshInterval,
        formattedMinLiquidity,
        networkList,
      };
    },
    [],
    {
      watchLoading: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    // Loading states
    isLoading,

    // Provide default values when data is not loaded yet
    basicConfig: result?.basicConfig,
    defaultNetworkId: result?.defaultNetworkId,
    recommendedTokens: result?.recommendedTokens || [],
    minLiquidity: result?.minLiquidity || 5000,
    refreshInterval: result?.refreshInterval || 5,
    formattedMinLiquidity: result?.formattedMinLiquidity || '5K',
    networkList: result?.networkList || [],
  };
}
