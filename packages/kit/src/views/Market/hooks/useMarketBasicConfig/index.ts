import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IMarketBasicConfigNetwork,
  IMarketBasicConfigToken,
  IMarketPerpsCategory,
  IMarketSpotCategory,
} from '@onekeyhq/shared/types/marketV2';

import {
  formatLiquidityValue,
  getDefaultNetworkId,
  getMinLiquidity,
  getNetworkList,
  getRefreshInterval,
} from './utils';

const EMPTY_TOKENS: IMarketBasicConfigToken[] = [];
const EMPTY_NETWORKS: IMarketBasicConfigNetwork[] = [];
const EMPTY_PERPS_CATEGORIES: IMarketPerpsCategory[] = [];
const EMPTY_SPOT_CATEGORIES: IMarketSpotCategory[] = [];

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

      const perpsCategories = configData.perpsCategories ?? [];
      const spotCategories = configData.spotCategories ?? [];
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
        perpsCategories,
        spotCategories,
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
    recommendedTokens: result?.recommendedTokens ?? EMPTY_TOKENS,
    minLiquidity: result?.minLiquidity ?? 5000,
    refreshInterval: result?.refreshInterval ?? 5,
    formattedMinLiquidity: result?.formattedMinLiquidity ?? '5K',
    networkList: result?.networkList ?? EMPTY_NETWORKS,
    perpsCategories: result?.perpsCategories ?? EMPTY_PERPS_CATEGORIES,
    spotCategories: result?.spotCategories ?? EMPTY_SPOT_CATEGORIES,
  };
}
