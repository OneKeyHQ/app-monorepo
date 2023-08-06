import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import useSWR from 'swr';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';

import type {
  BRC20TokenAmountItem,
  BRC20TokenAmountListResponse,
} from '../views/Send/types';

export function useBRC20AmountList({
  networkId,
  address,
  tokenAddress,
  xpub,
  isPolling,
  pollingInterval = 30 * 1000,
}: {
  networkId: string | undefined;
  address: string | undefined;
  tokenAddress: string | undefined;
  xpub: string | undefined;
  isPolling?: boolean;
  pollingInterval?: number;
}) {
  const [amountList, setAmountList] = useState<BRC20TokenAmountItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);

  const isFocused = useIsFocused();

  const fetchBRC20AmountList = useCallback(async () => {
    if (!networkId || !address || !tokenAddress) return;
    const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);

    const query = {
      network: networkId,
      address,
      tokenAddress,
      xpub,
    };

    setIsLoadingList(true);

    try {
      const resp = (await req
        .get('/token/balances/brc20Detail', query)
        .then((r) => r.json())) as BRC20TokenAmountListResponse;

      setAmountList([...resp.transferBalanceList]);
    } catch (e) {
      // pass
      console.log('fetchBRC20AmountList error', e);
    }
    setIsLoadingList(false);
  }, [address, networkId, tokenAddress, xpub]);

  const shouldDoRefresh = useMemo((): boolean => {
    if (!networkId || !address || !tokenAddress || !isPolling) {
      return false;
    }
    if (!isFocused) {
      return false;
    }
    return true;
  }, [address, isFocused, isPolling, networkId, tokenAddress]);

  const swrKey = 'fetchBRC20AmountList';
  const { mutate } = useSWR(swrKey, fetchBRC20AmountList, {
    refreshInterval: pollingInterval,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    isPaused() {
      return !shouldDoRefresh;
    },
  });

  useEffect(() => {
    if (shouldDoRefresh) {
      mutate();
    } else {
      fetchBRC20AmountList();
    }
  }, [mutate, shouldDoRefresh, networkId, fetchBRC20AmountList]);

  return { amountList, isLoadingList };
}
