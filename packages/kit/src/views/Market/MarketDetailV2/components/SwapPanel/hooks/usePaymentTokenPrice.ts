import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

interface IUsePaymentTokenPriceResult {
  price?: BigNumber;
  isLoading: boolean | undefined;
  refetch: () => void;
}

export function usePaymentTokenPrice(
  paymentToken?: ISwapTokenBase,
  networkId?: string,
): IUsePaymentTokenPriceResult {
  const {
    result: tokenDetail,
    isLoading,
    run: refetch,
  } = usePromiseResult(
    async () => {
      if (!networkId) {
        return undefined;
      }

      const detail = await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails(
        {
          networkId,
          contractAddress: paymentToken?.contractAddress ?? '',
        },
      );

      return detail?.[0];
    },
    [paymentToken?.contractAddress, networkId],
    {
      watchLoading: true,
      pollingInterval: 5000, // 5 seconds
    },
  );

  const price = useMemo(() => {
    if (!tokenDetail?.price) {
      return undefined;
    }
    const priceBN = new BigNumber(tokenDetail.price);
    return priceBN.isNaN() ? undefined : priceBN;
  }, [tokenDetail?.price]);

  return {
    price,
    isLoading,
    refetch,
  };
}
