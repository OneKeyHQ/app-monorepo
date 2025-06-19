import { useCallback } from 'react';

import {
  useNetworkIdAtom,
  useTokenAddressAtom,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

interface IUseMarketDetailDataProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketDetail() {
  const { current: tokenDetailActions } = useTokenDetailActions();
  const [storedTokenAddress] = useTokenAddressAtom();
  const [storedNetworkId] = useNetworkIdAtom();

  // Initialize token detail data (set state and fetch data)
  const initializeTokenDetail = useCallback(
    async (data: IUseMarketDetailDataProps) => {
      // Set the tokenAddress and networkId in jotai state
      tokenDetailActions.setTokenAddress(data.tokenAddress);
      tokenDetailActions.setNetworkId(data.networkId);

      // Fetch token detail data
      await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
      );
    },
    [tokenDetailActions],
  );

  // Manual fetch function (without setting state)
  const fetchTokenDetail = useCallback(
    async (data: IUseMarketDetailDataProps) => {
      await tokenDetailActions.fetchTokenDetail(
        data.tokenAddress,
        data.networkId,
      );
    },
    [tokenDetailActions],
  );

  const onRefresh = useCallback(async () => {
    await fetchTokenDetail({
      tokenAddress: storedTokenAddress,
      networkId: storedNetworkId,
    });
  }, [fetchTokenDetail, storedTokenAddress, storedNetworkId]);

  // Auto-initialize when component mounts or params change

  return {
    initializeTokenDetail,
    fetchTokenDetail,
    onRefresh,
  };
}
