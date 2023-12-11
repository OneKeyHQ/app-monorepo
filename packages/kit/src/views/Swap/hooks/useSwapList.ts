import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';
import type { ISwapNetwork } from '@onekeyhq/kit-bg/src/services/ServiceSwap';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useSwapNetworkTokenMapAtom,
  useSwapNetworksAtom,
} from '../../../states/jotai/contexts/swap';
import { SWAP_SOURCE_CACHE_EXPIRATION_TIME } from '../config/SwapSource.constants';

export function useSwapNetworkList() {
  const [, setSwapNetworks] = useSwapNetworksAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const dateNow = Date.now();
      const swapSourceNetworksCache =
        await simpleDb.swapSourceNetworks.getRawData();
      if (swapSourceNetworksCache && swapSourceNetworksCache.data) {
        setSwapNetworks(swapSourceNetworksCache.data);
        if (
          dateNow - simpleDb.swapSourceNetworks.updatedAt >=
          SWAP_SOURCE_CACHE_EXPIRATION_TIME
        ) {
          const networks =
            await backgroundApiProxy.serviceSwap.fetchSwapNetworks();
          await simpleDb.swapSourceNetworks.setRawData({ data: networks });
        }
      } else {
        const networks =
          await backgroundApiProxy.serviceSwap.fetchSwapNetworks();
        await simpleDb.swapSourceNetworks.setRawData({ data: networks });
        setSwapNetworks(networks);
      }
    },
    [setSwapNetworks],
    { watchLoading: true },
  );
  return { fetchLoading: isLoading };
}

export function useSwapTokenList(network: ISwapNetwork) {
  const [, setSwapTokens] = useSwapNetworkTokenMapAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const dateNow = Date.now();
      const swapSourceTokensCache =
        await simpleDb.swapSourceTokens.getRawData();
      if (swapSourceTokensCache?.data?.[network.networkId]?.tokens) {
        setSwapTokens((pre) => ({
          ...pre,
          [network.networkId]:
            swapSourceTokensCache.data[network.networkId].tokens,
        }));
        if (
          dateNow - swapSourceTokensCache.data[network.networkId].updateAt >=
          SWAP_SOURCE_CACHE_EXPIRATION_TIME
        ) {
          const tokens = await backgroundApiProxy.serviceSwap.fetchSwapTokens(
            network,
          );
          await simpleDb.swapSourceTokens.updateSwapSourceTokens(
            network.networkId,
            tokens,
          );
        }
      } else {
        const tokens = await backgroundApiProxy.serviceSwap.fetchSwapTokens(
          network,
        );
        await simpleDb.swapSourceTokens.updateSwapSourceTokens(
          network.networkId,
          tokens,
        );
        setSwapTokens((pre) => ({
          ...pre,
          [network.networkId]: tokens,
        }));
      }
    },
    [network, setSwapTokens],
    { watchLoading: true },
  );
  return { fetchLoading: isLoading };
}
