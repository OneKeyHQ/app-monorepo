import { useCallback, useMemo } from 'react';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectedTokenBalanceAtom,
  useSwapTokenMapAtom,
} from '../../../states/jotai/contexts/swap';

import type { IFetchTokensParams, ISwapToken } from '../types';

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
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const { catchSwapTokensMap } = useSwapActions().current;
  const { activeAccount } = useActiveAccount({
    num: selectTokenModalType === 'from' ? 0 : 1,
  });
  const [fromToken] = useSwapSelectFromTokenAtom();
  const tokenFetchParams = useMemo(
    () => ({
      networkId: currentNetworkId,
      type: selectTokenModalType,
      fromToken,
      keywords,
      accountAddress: activeAccount.account?.address,
      accountNetworkId: activeAccount.network?.id,
      accountXpub: (activeAccount.account as IDBUtxoAccount)?.xpub,
    }),
    [
      activeAccount.account,
      activeAccount.network?.id,
      currentNetworkId,
      fromToken,
      keywords,
      selectTokenModalType,
    ],
  );

  const currentTokens =
    tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [];

  const fetchTokens = useCallback(
    async (params: IFetchTokensParams) => {
      const mapKey = JSON.stringify(params);
      const { result } = await backgroundApiProxy.serviceSwap.fetchSwapTokens(
        params,
      );
      if (result.length > 0) {
        await catchSwapTokensMap(mapKey, result);
      }
    },
    [catchSwapTokensMap],
  );
  const { isLoading } = usePromiseResult(
    async () => {
      await fetchTokens(tokenFetchParams);
    },
    [fetchTokens, tokenFetchParams],
    { watchLoading: true, debounced: 500 },
  );

  return {
    fetchLoading: isLoading && currentTokens.length === 0,
    currentTokens,
  };
}

export function useSwapSelectedTokenDetail({
  token,
  accountAddress,
  accountNetworkId,
  accountXpub,
}: {
  token?: ISwapToken;
  accountAddress?: string;
  accountNetworkId?: string;
  accountXpub?: string;
}) {
  const [swapSelectedTokenBalance, setSwapSelectedTokenBalance] =
    useSwapSelectedTokenBalanceAtom();

  const { isLoading } = usePromiseResult(
    async () => {
      if (!token || !accountAddress || !accountNetworkId) return;
      if (
        token.accountAddress === accountAddress &&
        accountNetworkId === token.networkId
      ) {
        setSwapSelectedTokenBalance(token.balanceParsed ?? '0.0');
      } else {
        const detailInfo =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: token.networkId,
            accountAddress,
            xpub: accountXpub,
            contractAddress: token.contractAddress,
          });
        if (detailInfo) {
          setSwapSelectedTokenBalance(detailInfo.balanceParsed);
        }
      }
    },
    [
      accountAddress,
      accountNetworkId,
      accountXpub,
      setSwapSelectedTokenBalance,
      token,
    ],
    {
      watchLoading: true,
    },
  );
  return { isLoading, swapSelectedTokenBalance };
}
