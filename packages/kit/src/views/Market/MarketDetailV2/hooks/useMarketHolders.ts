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

      // Process holders data with percentage calculation based on total supply from FDV
      const processedList = response.list.map((holder) => {
        let percentage: string | undefined;

        if (
          holder.amount &&
          isReady &&
          tokenDetail?.fdv &&
          tokenDetail?.price
        ) {
          try {
            const holderAmount = new BigNumber(holder.amount);
            const fdv = new BigNumber(tokenDetail.fdv);
            const price = new BigNumber(tokenDetail.price);

            if (fdv.isGreaterThan(0) && price.isGreaterThan(0)) {
              // Calculate total supply = fdv / price
              const totalSupply = fdv.dividedBy(price);

              if (totalSupply.isGreaterThan(0)) {
                const percentageValue = holderAmount
                  .dividedBy(totalSupply)
                  .multipliedBy(100);
                percentage = percentageValue.toFixed(2);
              }
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
    [tokenAddress, networkId, isReady, tokenDetail?.fdv, tokenDetail?.price],
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
