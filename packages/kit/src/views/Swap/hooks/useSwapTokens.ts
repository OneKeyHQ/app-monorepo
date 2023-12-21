import { useCallback, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
} from '../../../states/jotai/contexts/swap';

import type { ISwapToken } from '../types';

export function useSwapNetworkList() {
  const [, setSwapNetworks] = useSwapNetworksAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      let networks = await backgroundApiProxy.serviceSwap.fetchSwapNetworks();

      const swapNetworksSortList =
        await backgroundApiProxy.simpleDb.swapNetworksSort.getRawData();
      if (swapNetworksSortList && swapNetworksSortList.data) {
        const sortNetworks = swapNetworksSortList.data;
        networks = sortNetworks
          .filter((network) =>
            networks.find((n) => n.networkId === network.networkId),
          )
          .concat(
            networks.filter(
              (network) =>
                !sortNetworks.find((n) => n.networkId === network.networkId),
            ),
          );
      }
      await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
        data: networks,
      });
      setSwapNetworks(networks);
    },
    [setSwapNetworks],
    { watchLoading: true },
  );
  return { fetchLoading: isLoading };
}

export function useSwapTokenList(
  selectTokenModalType: 'from' | 'to',
  currentNetworkId?: string,
) {
  const [currentTokens, setCurrentTokens] = useState<ISwapToken[]>([]);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fetchLoading, setFetchLoading] = useState(false);
  const fetchTokens = useCallback(
    async ({
      networkId,
      keyword,
    }: {
      networkId?: string;
      keyword?: string;
    }) => {
      if (fetchLoading) return;
      setFetchLoading(true);
      const { result } = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId,
        type: selectTokenModalType,
        keyword,
        fromToken,
      });

      setCurrentTokens(result);
      setFetchLoading(false);
    },
    [fetchLoading, fromToken, selectTokenModalType],
  );
  const { isLoading } = usePromiseResult(
    async () => {
      const { result } = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId: currentNetworkId,
        type: selectTokenModalType,
        fromToken,
      });
      setCurrentTokens(result);
      setFetchLoading(false);
    },
    [currentNetworkId, fromToken, selectTokenModalType],
    { watchLoading: true },
  );

  return {
    fetchLoading: fetchLoading || isLoading,
    fetchTokens,
    currentTokens,
  };
}
