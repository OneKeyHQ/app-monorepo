import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IFetchTokensParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
  useSwapTokenMapAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './uswSwapAccount';

export function useSwapNetworkList() {
  const [, setSwapNetworks] = useSwapNetworksAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      let networks = await backgroundApiProxy.serviceSwap.fetchSwapNetworks();

      const swapNetworksSortList =
        await backgroundApiProxy.simpleDb.swapNetworksSort.getRawData();

      if (!networks?.length && swapNetworksSortList?.data) {
        networks = swapNetworksSortList.data;
      }
      if (swapNetworksSortList?.data && networks?.length) {
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
  selectTokenModalType: ESwapDirectionType,
  currentNetworkId?: string,
  keywords?: string,
) {
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const { catchSwapTokensMap } = useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const tokenFetchParams = useMemo(
    () => ({
      networkId: currentNetworkId,
      type: selectTokenModalType,
      fromToken,
      keywords,
      accountAddress:
        selectTokenModalType === ESwapDirectionType.FROM
          ? swapAddressInfo?.address
          : undefined,
      accountNetworkId:
        selectTokenModalType === ESwapDirectionType.FROM
          ? swapAddressInfo?.networkId
          : undefined,
      accountXpub:
        selectTokenModalType === ESwapDirectionType.FROM
          ? (swapAddressInfo?.accountInfo?.account as IDBUtxoAccount)?.xpub
          : undefined,
    }),
    [
      currentNetworkId,
      selectTokenModalType,
      fromToken,
      keywords,
      swapAddressInfo?.address,
      swapAddressInfo?.networkId,
      swapAddressInfo?.accountInfo?.account,
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

export function useSwapSelectedTokenInfo({
  token,
  type,
}: {
  type: ESwapDirectionType;
  token?: ISwapToken;
}) {
  const swapAddressInfo = useSwapAddressInfo(type);
  const accountAddress = swapAddressInfo.address;
  const accountNetworkId = swapAddressInfo.networkId;
  const accountXpub = (swapAddressInfo.accountInfo?.account as IDBUtxoAccount)
    ?.xpub;
  const [, setSwapSelectedFromTokenBalance] =
    useSwapSelectedFromTokenBalanceAtom();

  const [, setSwapSelectedToTokenBalance] = useSwapSelectedToTokenBalanceAtom();

  const { isLoading } = usePromiseResult(
    async () => {
      let balanceDisplay;
      if (!(!token || !accountAddress || !accountNetworkId)) {
        if (
          token.accountAddress === accountAddress &&
          accountNetworkId === token.networkId &&
          type === ESwapDirectionType.FROM
        ) {
          const balanceParsedBN = new BigNumber(token.balanceParsed ?? 0);
          balanceDisplay = balanceParsedBN.isNaN()
            ? '0'
            : balanceParsedBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed();
        } else {
          const detailInfo =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: token.networkId,
              accountAddress,
              xpub: accountXpub,
              contractAddress: token.contractAddress,
            });
          if (detailInfo) {
            const balanceParsedBN = new BigNumber(
              detailInfo.balanceParsed ?? 0,
            );
            balanceDisplay = balanceParsedBN.isNaN()
              ? '0.0'
              : balanceParsedBN
                  .decimalPlaces(6, BigNumber.ROUND_DOWN)
                  .toFixed();
          }
        }
      }
      if (type === ESwapDirectionType.FROM) {
        setSwapSelectedFromTokenBalance(balanceDisplay ?? '0.0');
      } else {
        setSwapSelectedToTokenBalance(balanceDisplay ?? '0.0');
      }
    },
    [
      accountAddress,
      accountNetworkId,
      accountXpub,
      setSwapSelectedFromTokenBalance,
      setSwapSelectedToTokenBalance,
      token,
      type,
    ],
    {
      watchLoading: true,
      debounced: 500,
    },
  );
  return {
    isLoading,
  };
}
