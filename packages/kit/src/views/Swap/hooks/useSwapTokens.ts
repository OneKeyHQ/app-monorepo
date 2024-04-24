import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  ISwapInitParams,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapProviderSortAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
  useSwapTokenFetchingAtom,
  useSwapTokenMapAtom,
  useSwapTxHistoryStatusChangeAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapInit(params?: ISwapInitParams) {
  const [swapNetworks, setSwapNetworks] = useSwapNetworksAtom();
  const [fromToken, setFromToken] = useSwapSelectFromTokenAtom();
  const [, setToToken] = useSwapSelectToTokenAtom();
  const [, setSelectSort] = useSwapProviderSortAtom();
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [defaultTokenLoading, setDefaultTokenLoading] = useState<boolean>(true);
  const [networkListFetching, setNetworkListFetching] = useState<boolean>(true);

  const swapAddressInfoRef = useRef<ReturnType<typeof useSwapAddressInfo>>();
  if (swapAddressInfoRef.current !== swapAddressInfo) {
    swapAddressInfoRef.current = swapAddressInfo;
  }

  const swapNetworksRef = useRef<ISwapNetwork[]>([]);
  if (swapNetworksRef.current !== swapNetworks) {
    swapNetworksRef.current = swapNetworks;
  }
  const fromTokenRef = useRef<ISwapToken>();
  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  const fetchSwapNetworks = useCallback(async () => {
    if (swapNetworks.length) {
      setNetworkListFetching(false);
      return;
    }
    const swapNetworksSortList =
      await backgroundApiProxy.simpleDb.swapNetworksSort.getRawData();
    if (swapNetworksSortList?.data?.length) {
      setSwapNetworks(swapNetworksSortList.data);
      setNetworkListFetching(false);
    }
    let networks: ISwapNetwork[] = [];
    const fetchNetworks =
      await backgroundApiProxy.serviceSwap.fetchSwapNetworks();
    if (!fetchNetworks?.length && swapNetworksSortList?.data) {
      networks = swapNetworksSortList.data;
    }
    if (swapNetworksSortList?.data && fetchNetworks?.length) {
      const sortNetworks = swapNetworksSortList.data;
      networks = sortNetworks
        .filter((network) =>
          fetchNetworks.find((n) => n.networkId === network.networkId),
        )
        .map((net) => {
          const serverNetwork = fetchNetworks.find(
            (n) => n.networkId === net.networkId,
          );
          return { ...net, ...serverNetwork };
        })
        .concat(
          fetchNetworks.filter(
            (network) =>
              !sortNetworks.find((n) => n.networkId === network.networkId),
          ),
        );
    }
    await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
      data: networks,
    });
    if (!swapNetworksSortList?.data?.length) {
      setSwapNetworks(networks);
      setNetworkListFetching(false);
    }
  }, [setSwapNetworks, swapNetworks.length]);

  const syncDefaultSelectedToken = useCallback(async () => {
    if (params?.importFromToken || params?.importToToken) {
      setFromToken(params.importFromToken);
      setToToken(params.importToToken);
      setDefaultTokenLoading(false);
      return;
    }
    if (
      !swapAddressInfoRef.current?.accountInfo?.ready ||
      !swapAddressInfoRef.current?.networkId ||
      !swapNetworksRef.current.length ||
      (params?.importNetworkId &&
        swapAddressInfoRef.current?.networkId &&
        params?.importNetworkId !== swapAddressInfoRef.current?.networkId) ||
      !!fromTokenRef.current
    ) {
      return;
    }
    const accountNetwork = swapNetworksRef.current.find(
      (net) => net.networkId === swapAddressInfoRef.current?.networkId,
    );
    if (accountNetwork) {
      if (
        !isNil(accountNetwork.defaultSelectToken?.from) ||
        !isNil(accountNetwork.defaultSelectToken?.to)
      ) {
        try {
          const tokenInfos =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: accountNetwork.networkId,
              accountAddress: swapAddressInfoRef.current?.address,
              xpub: (
                swapAddressInfoRef.current?.accountInfo
                  ?.account as IDBUtxoAccount
              )?.xpub,
              contractAddress: `${
                !isNil(accountNetwork.defaultSelectToken?.from)
                  ? accountNetwork.defaultSelectToken?.from
                  : ''
              }${
                !isNil(accountNetwork.defaultSelectToken?.to)
                  ? `${
                      !isNil(accountNetwork.defaultSelectToken?.from) ? ',' : ''
                    }${accountNetwork.defaultSelectToken?.to}`
                  : ''
              }`,
            });
          const defaultFromToken = tokenInfos?.find(
            (token) =>
              token.contractAddress.toLowerCase() ===
              accountNetwork.defaultSelectToken?.from?.toLowerCase(),
          );
          const defaultToToken = tokenInfos?.find(
            (token) =>
              token.contractAddress.toLowerCase() ===
              accountNetwork.defaultSelectToken?.to?.toLowerCase(),
          );
          if (defaultFromToken) {
            setFromToken({
              ...defaultFromToken,
              networkLogoURI: accountNetwork.logoURI,
            });
          }
          if (defaultToToken) {
            setToToken({
              ...defaultToToken,
              networkLogoURI: accountNetwork.logoURI,
            });
          }
        } catch (e) {
          console.error(e);
        } finally {
          setDefaultTokenLoading(false);
        }
      } else {
        setDefaultTokenLoading(false);
      }
    }
  }, [
    params?.importFromToken,
    params?.importNetworkId,
    params?.importToToken,
    setFromToken,
    setToToken,
  ]);
  useEffect(() => {
    void (async () => {
      await fetchSwapNetworks();
    })();
  }, [fetchSwapNetworks, swapNetworks.length]);

  useEffect(() => {
    void (async () => {
      const swapConfigs =
        await backgroundApiProxy.simpleDb.swapConfigs.getRawData();
      if (swapConfigs?.providerSort) {
        setSelectSort(swapConfigs.providerSort);
      }
    })();
  }, [setSelectSort]);

  useEffect(() => {
    void (async () => {
      if (
        params?.importNetworkId &&
        swapAddressInfo.networkId &&
        params?.importNetworkId !== swapAddressInfo.networkId
      ) {
        await updateSelectedAccountNetwork({
          num: 0,
          networkId: params.importNetworkId,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.importNetworkId, updateSelectedAccountNetwork]);

  useEffect(() => {
    void (async () => {
      await syncDefaultSelectedToken();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    swapAddressInfo.accountInfo?.ready,
    swapNetworks.length,
    swapAddressInfo.networkId,
    params?.importFromToken,
    params?.importToToken,
    params?.importNetworkId,
  ]);

  return {
    fetchLoading: networkListFetching || defaultTokenLoading,
  };
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
  const [fromToken, setFromToken] = useSwapSelectFromTokenAtom();
  const [toToken, setToToken] = useSwapSelectToTokenAtom();
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
            if (detailInfo[0].price) {
              if (type === ESwapDirectionType.FROM) {
                if (
                  !fromToken?.price ||
                  !fromToken?.fiatValue ||
                  !fromToken.balanceParsed
                ) {
                  setFromToken({
                    ...token,
                    price: detailInfo[0].price,
                    fiatValue: detailInfo[0].fiatValue,
                    balanceParsed: detailInfo[0].balanceParsed,
                    accountAddress,
                  });
                }
              } else if (
                !toToken?.price ||
                !toToken?.fiatValue ||
                !toToken.balanceParsed
              ) {
                setToToken({
                  ...token,
                  price: detailInfo[0].price,
                  fiatValue: detailInfo[0].fiatValue,
                  balanceParsed: detailInfo[0].balanceParsed,
                  accountAddress,
                });
              }
              balanceDisplay = balanceParsedBN.isNaN()
                ? '0.0'
                : balanceParsedBN.toFixed();
            }
          }
        }
      }
      if (type === ESwapDirectionType.FROM) {
        setSwapSelectedFromTokenBalance(balanceDisplay ?? '0.0');
      } else {
        setSwapSelectedToTokenBalance(balanceDisplay ?? '0.0');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      swapTxHistoryStatusChange,
      token,
      accountAddress,
      accountNetworkId,
      type,
      accountXpub,
      setFromToken,
      setToToken,
      setSwapSelectedFromTokenBalance,
      setSwapSelectedToTokenBalance,
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
