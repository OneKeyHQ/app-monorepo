import { useState } from 'react';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
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
  keywords?: string,
) {
  const [currentTokens, setCurrentTokens] = useState<ISwapToken[]>([]);
  const { activeAccount } = useActiveAccount({
    num: selectTokenModalType === 'from' ? 0 : 1,
  });
  const [fromToken] = useSwapSelectFromTokenAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      let isUtxo;
      if (activeAccount.network?.id) {
        isUtxo = await backgroundApiProxy.serviceAccount.getNetworkIsUtxo({
          networkId: activeAccount.network?.id,
        });
      }
      const { result } = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId: currentNetworkId,
        type: selectTokenModalType,
        fromToken,
        keywords,
        accountAddress: activeAccount.account?.address,
        accountNetworkId: activeAccount.network?.id,
        accountXpub: isUtxo
          ? (activeAccount.account as IDBUtxoAccount)?.xpub
          : undefined,
      });
      setCurrentTokens(result);
    },
    [
      activeAccount,
      currentNetworkId,
      fromToken,
      keywords,
      selectTokenModalType,
    ],
    { watchLoading: true, debounced: 500 },
  );

  return {
    fetchLoading: isLoading,
    currentTokens,
  };
}
