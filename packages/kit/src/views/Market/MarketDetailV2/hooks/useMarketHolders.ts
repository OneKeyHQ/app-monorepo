import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useTokenDetail } from './useTokenDetail';

interface IUseMarketHoldersProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketHolders({
  tokenAddress,
  networkId,
}: IUseMarketHoldersProps) {
  const { tokenDetail, isReady } = useTokenDetail();

  const {
    result: holdersData,
    isLoading: isRefreshing,
    run: fetchHolders,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenHolders({
          tokenAddress,
          networkId,
        });

      // Process holders data with percentage calculation only when marketCap is available
      const processedList = response.list.map((holder) => {
        let percentage: string | undefined;

        if (holder.fiatValue && isReady && tokenDetail?.marketCap) {
          try {
            const holderValue = new BigNumber(holder.fiatValue);
            const totalMarketCap = new BigNumber(tokenDetail.marketCap);

            if (totalMarketCap.isGreaterThan(0)) {
              const percentageValue = holderValue
                .dividedBy(totalMarketCap)
                .multipliedBy(100);
              percentage = percentageValue.toFixed(2);
            }
          } catch (error) {
            // Keep percentage as undefined on error
          }
        }

        return {
          ...holder,
          percentage,
        };
      });

      return {
        ...response,
        list: processedList,
      };
    },
    [tokenAddress, networkId, isReady, tokenDetail?.marketCap],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  const onRefresh = useCallback(async () => {
    await fetchHolders();
  }, [fetchHolders]);

  return {
    holders: holdersData?.list || [],
    fetchHolders,
    isRefreshing,
    onRefresh,
  };
}
