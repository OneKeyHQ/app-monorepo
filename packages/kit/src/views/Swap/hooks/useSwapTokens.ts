import { useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { mockAddress, mockNetworkId } from '../utils/utils';

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
  keywords?: string,
) {
  const [currentTokens, setCurrentTokens] = useState<ISwapToken[]>([]);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const { result } = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId: currentNetworkId,
        type: selectTokenModalType,
        fromToken,
        keywords,
        accountAddress: mockAddress,
        accountNetworkId: mockNetworkId,
        // accountXpub: mockAddress,
      });
      setCurrentTokens(result);
    },
    [currentNetworkId, fromToken, keywords, selectTokenModalType],
    { watchLoading: true, debounced: 500 },
  );

  return {
    fetchLoading: isLoading,
    currentTokens,
  };
}
