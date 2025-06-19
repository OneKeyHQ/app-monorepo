import { useCallback, useEffect } from 'react';

import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

interface IUseMarketDetailDataProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketDetail({
  tokenAddress,
  networkId,
}: IUseMarketDetailDataProps) {
  const actions = useTokenDetailActions();

  // Fetch token detail when hook is called
  const fetchTokenDetail = useCallback(async () => {
    await actions.current.fetchTokenDetail(tokenAddress, networkId);
  }, [actions, tokenAddress, networkId]);

  const onRefresh = useCallback(async () => {
    await fetchTokenDetail();
  }, [fetchTokenDetail]);

  useEffect(() => {
    void fetchTokenDetail();
  }, [fetchTokenDetail]);

  return {
    fetchTokenDetail,
    onRefresh,
  };
}
