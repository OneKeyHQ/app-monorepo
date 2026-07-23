import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketBasicConfigData,
  IMarketBasicConfigHomeTab,
  IMarketBasicConfigNetwork,
  IMarketBasicConfigToken,
  IMarketPerpsCategory,
  IMarketSpotCategory,
  IMarketStockCategory,
} from '@onekeyhq/shared/types/marketV2';

import {
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
} from './fetchMarketBasicConfigForPlatform';
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
const EMPTY_STOCK_CATEGORIES: IMarketStockCategory[] = [];
const EMPTY_HOME_TABS: IMarketBasicConfigHomeTab[] = [];

function buildMarketBasicConfigResult(configData?: IMarketBasicConfigData) {
  if (!configData) {
    return null;
  }

  const defaultNetworkId = getDefaultNetworkId(configData);
  const recommendedTokens = configData.recommendTokens;
  const minLiquidity = getMinLiquidity(configData);
  const refreshInterval = getRefreshInterval(configData);
  const formattedMinLiquidity = formatLiquidityValue(minLiquidity);
  const networkList = getNetworkList(configData);

  return {
    basicConfig: configData,
    defaultNetworkId,
    recommendedTokens,
    minLiquidity,
    refreshInterval,
    formattedMinLiquidity,
    networkList,
    homeTab: configData.homeTab ?? [],
    perpsCategories: configData.perpsCategories ?? [],
    spotCategories: configData.spotCategories ?? [],
    stockCategories: configData.stockCategories ?? [],
  };
}

/**
 * Hook to fetch and manage market basic configuration
 * Provides default network, recommended tokens, and other market settings
 */
export function useMarketBasicConfig() {
  const cachedResult = buildMarketBasicConfigResult(
    getCachedMarketBasicConfigForPlatform()?.data,
  );
  const { result, isLoading } = usePromiseResult(
    async () => {
      const response = await fetchMarketBasicConfigForPlatform();
      return buildMarketBasicConfigResult(response?.data);
    },
    [],
    {
      checkIsFocused: !platformEnv.isWeb,
      initResult: cachedResult,
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
    homeTab: result?.homeTab ?? EMPTY_HOME_TABS,
    perpsCategories: result?.perpsCategories ?? EMPTY_PERPS_CATEGORIES,
    spotCategories: result?.spotCategories ?? EMPTY_SPOT_CATEGORIES,
    stockCategories: result?.stockCategories ?? EMPTY_STOCK_CATEGORIES,
  };
}
