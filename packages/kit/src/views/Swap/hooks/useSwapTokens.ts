import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
  useSwapTokenFetchingAtom,
  useSwapTokenMapAtom,
  useSwapTxHistoryStatusChangeAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapNetworkList() {
  const [, setSwapNetworks] = useSwapNetworksAtom();
  // const [, setFromToken] = useSwapSelectFromTokenAtom();
  // const [, setToToken] = useSwapSelectToTokenAtom();
  // const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
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
          .map((net) => {
            const serverNetwork = networks.find(
              (n) => n.networkId === net.networkId,
            );
            return { ...net, ...serverNetwork };
          })
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
      // if (swapAddressInfo.networkId) {
      //   const accountNetwork = networks.find(
      //     (net) => net.networkId === swapAddressInfo.networkId,
      //   );
      //   if (accountNetwork) {
      //     if (
      //       !isNil(accountNetwork.defaultSelectToken?.from) ||
      //       !isNil(accountNetwork.defaultSelectToken?.to)
      //     ) {
      //       const tokenInfos =
      //         await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
      //           networkId: accountNetwork.networkId,
      //           accountAddress: swapAddressInfo.address,
      //           xpub: (swapAddressInfo.accountInfo?.account as IDBUtxoAccount)
      //             ?.xpub,
      //           contractAddress: `${
      //             !isNil(accountNetwork.defaultSelectToken?.from)
      //               ? accountNetwork.defaultSelectToken?.from
      //               : ''
      //           }${
      //             !isNil(accountNetwork.defaultSelectToken?.to)
      //               ? `${
      //                   !isNil(accountNetwork.defaultSelectToken?.from)
      //                     ? ','
      //                     : ''
      //                 }${accountNetwork.defaultSelectToken?.to}`
      //               : ''
      //           }`,
      //         });
      //       const defaultFromToken = tokenInfos?.find(
      //         (token) =>
      //           token.contractAddress ===
      //           accountNetwork.defaultSelectToken?.from,
      //       );
      //       const defaultToToken = tokenInfos?.find(
      //         (token) =>
      //           token.contractAddress === accountNetwork.defaultSelectToken?.to,
      //       );
      //       if (defaultFromToken) {
      //         setFromToken(defaultFromToken);
      //       }
      //       if (defaultToToken) {
      //         setToToken(defaultToToken);
      //       }
      // }
      // }
      // }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [currentTokens, setCurrentTokens] = useState<ISwapToken[]>([]);
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const { tokenListFetchAction } = useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [swapTokenFetching] = useSwapTokenFetchingAtom();
  const tokenFetchParams = useMemo(
    () => ({
      networkId: currentNetworkId,
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
      keywords,
      swapAddressInfo?.address,
      swapAddressInfo?.networkId,
      swapAddressInfo?.accountInfo?.account,
    ],
  );

  useEffect(() => {
    if (
      tokenFetchParams.accountNetworkId &&
      tokenFetchParams.networkId !== 'all' &&
      tokenFetchParams.networkId !== tokenFetchParams.accountNetworkId
    ) {
      // current network is not the same as account network skip fetch
      return;
    }
    void tokenListFetchAction(tokenFetchParams);
  }, [tokenFetchParams, tokenListFetchAction]);

  useEffect(() => {
    if (
      tokenFetchParams.accountNetworkId &&
      tokenFetchParams.networkId !== 'all' &&
      tokenFetchParams.networkId !== tokenFetchParams.accountNetworkId
    ) {
      return;
    }
    setCurrentTokens(
      tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
    );
  }, [tokenCatch, tokenFetchParams, currentNetworkId]);

  return {
    fetchLoading: swapTokenFetching && currentTokens.length === 0,
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
  const [swapTxHistoryStatusChange] = useSwapTxHistoryStatusChangeAtom();
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
      if (
        swapTxHistoryStatusChange.length > 0 &&
        swapTxHistoryStatusChange.every(
          (item) => item.status !== ESwapTxHistoryStatus.SUCCESS,
        )
      ) {
        return;
      }
      if (!(!token || !accountAddress || !accountNetworkId)) {
        if (
          token.accountAddress === accountAddress &&
          accountNetworkId === token.networkId
        ) {
          const balanceParsedBN = new BigNumber(token.balanceParsed ?? 0);
          balanceDisplay = balanceParsedBN.isNaN()
            ? '0.0'
            : balanceParsedBN.toFixed();
        } else {
          const detailInfo =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: token.networkId,
              accountAddress,
              xpub: accountXpub,
              contractAddress: token.contractAddress,
            });
          if (detailInfo?.[0]) {
            const balanceParsedBN = new BigNumber(
              detailInfo[0].balanceParsed ?? 0,
            );
            balanceDisplay = balanceParsedBN.isNaN()
              ? '0.0'
              : balanceParsedBN.toFixed();
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
      swapTxHistoryStatusChange,
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
