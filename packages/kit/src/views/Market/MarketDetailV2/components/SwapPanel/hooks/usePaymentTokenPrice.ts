import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

interface IUsePaymentTokenPriceResult {
  price?: BigNumber;
  tokenKey?: string;
  isLoading: boolean | undefined;
  refetch: () => void;
}

type IPaymentTokenPriceResult = {
  tokenDetail?: ISwapToken;
  tokenKey: string;
};

export function usePaymentTokenPrice(
  paymentToken?: ISwapTokenBase,
  networkId?: string,
  currencyId?: string,
): IUsePaymentTokenPriceResult {
  const hasPaymentToken = Boolean(paymentToken);
  const paymentContractAddress = paymentToken?.contractAddress ?? '';
  const paymentTokenKey = `${networkId ?? ''}:${paymentContractAddress}:${
    currencyId ?? ''
  }`;
  const {
    result: paymentTokenPriceResult,
    isLoading,
    run: refetch,
  } = usePromiseResult(
    async (): Promise<IPaymentTokenPriceResult | undefined> => {
      if (!networkId || !currencyId || !hasPaymentToken) {
        return undefined;
      }

      const detail = await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails(
        {
          networkId,
          contractAddress: paymentContractAddress,
          currency: currencyId,
        },
      );

      return {
        tokenDetail: detail?.[0]
          ? {
              ...detail[0],
              currency: currencyId,
            }
          : undefined,
        tokenKey: paymentTokenKey,
      };
    },
    [
      currencyId,
      hasPaymentToken,
      networkId,
      paymentContractAddress,
      paymentTokenKey,
    ],
    {
      watchLoading: true,
      pollingInterval: 5000, // 5 seconds
      undefinedResultIfReRun: true,
    },
  );

  const price = useMemo(() => {
    if (!paymentTokenPriceResult?.tokenDetail?.price) {
      return undefined;
    }
    const priceBN = new BigNumber(paymentTokenPriceResult.tokenDetail.price);
    return priceBN.isNaN() ? undefined : priceBN;
  }, [paymentTokenPriceResult?.tokenDetail?.price]);

  return {
    price,
    tokenKey: paymentTokenPriceResult?.tokenKey,
    isLoading,
    refetch,
  };
}
