import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { EPageType, usePageType } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
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
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapAllNetworkTokenListAtom,
  useSwapNetworksAtom,
  useSwapProviderSortAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTokenFetchingAtom,
  useSwapTokenMapAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapInit(params?: ISwapInitParams) {
  const [swapNetworks, setSwapNetworks] = useSwapNetworksAtom();
  const [fromToken, setFromToken] = useSwapSelectFromTokenAtom();
  const [toToken, setToToken] = useSwapSelectToTokenAtom();
  const [, setSelectSort] = useSwapProviderSortAtom();
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
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
  const toTokenRef = useRef<ISwapToken>();
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
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
    networks = [...fetchNetworks];
    if (swapNetworksSortList?.data?.length && fetchNetworks?.length) {
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
    if (networks.length) {
      await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
        data: networks,
      });
      if (
        !swapNetworksSortList?.data?.length ||
        swapNetworksSortList?.data?.length !== networks.length
      ) {
        setSwapNetworks(networks);
        setNetworkListFetching(false);
      }
    }
  }, [setSwapNetworks, swapNetworks.length]);

  const syncDefaultSelectedToken = useCallback(async () => {
    if (!!fromTokenRef.current || !!toTokenRef.current) {
      return;
    }
    if (
      (params?.importFromToken &&
        swapNetworksRef.current.find(
          (net) => net.networkId === params?.importFromToken?.networkId,
        )) ||
      (params?.importToToken &&
        swapNetworksRef.current.find(
          (net) => net.networkId === params?.importFromToken?.networkId,
        ))
    ) {
      setFromToken(params.importFromToken);
      setToToken(params.importToToken);
      return;
    }
    if (
      !swapAddressInfoRef.current?.accountInfo?.ready ||
      !swapAddressInfoRef.current?.networkId ||
      !swapNetworksRef.current.length ||
      (params?.importNetworkId &&
        swapAddressInfoRef.current?.networkId &&
        params?.importNetworkId !== swapAddressInfoRef.current?.networkId)
    ) {
      return;
    }
    const accountNetwork = swapNetworksRef.current.find(
      (net) => net.networkId === swapAddressInfoRef.current?.networkId,
    );
    const isAllNet = networkUtils.isAllNetwork({
      networkId: swapAddressInfoRef.current?.networkId,
    });

    let netInfo = accountNetwork;
    let netId = accountNetwork?.networkId;
    if (isAllNet) {
      netId = getNetworkIdsMap().onekeyall;
      netInfo = swapNetworksRef.current.find(
        (net) => net.networkId === 'evm--1',
      ); // all net use evm default token
    }

    if (netInfo && netId) {
      if (
        !isNil(swapDefaultSetTokens[netId]?.fromToken) ||
        !isNil(swapDefaultSetTokens[netId]?.toToken)
      ) {
        const defaultFromToken = swapDefaultSetTokens[netId]?.fromToken;
        const defaultToToken = swapDefaultSetTokens[netId]?.toToken;
        if (defaultFromToken) {
          setFromToken({
            ...defaultFromToken,
            networkLogoURI: netInfo?.logoURI,
          });
        }
        if (defaultToToken) {
          setToToken({
            ...defaultToToken,
            networkLogoURI: netInfo?.logoURI,
          });
        }
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
        swapAddressInfoRef.current?.networkId &&
        params.importNetworkId !== swapAddressInfoRef.current.networkId
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
    fetchLoading: networkListFetching,
  };
}

export function useSwapTokenList(
  selectTokenModalType: ESwapDirectionType,
  currentNetworkId?: string,
  keywords?: string,
) {
  const [currentTokens, setCurrentTokens] = useState<
    (ISwapToken | IFuseResult<ISwapToken>)[]
  >([]);
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const [swapAllNetworkTokenList] = useSwapAllNetworkTokenListAtom();
  const [swapNetworks] = useSwapNetworksAtom();
  const { tokenListFetchAction } = useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [swapTokenFetching] = useSwapTokenFetchingAtom();
  const tokenFetchParams = useMemo(
    () => ({
      networkId: currentNetworkId,
      keywords,
      accountAddress: swapAddressInfo?.address,
      accountNetworkId: swapAddressInfo?.networkId,
      accountId: swapAddressInfo?.accountInfo?.account?.id,
    }),
    [
      currentNetworkId,
      keywords,
      swapAddressInfo?.address,
      swapAddressInfo?.networkId,
      swapAddressInfo?.accountInfo?.account,
    ],
  );

  const sortAllNetworkTokens = useCallback((tokens: ISwapToken[]) => {
    const havePriceTokens = tokens
      .filter((token) => {
        const priceBN = new BigNumber(token.price ?? '0');
        return !priceBN.isNaN() && !priceBN.isZero();
      })
      ?.sort((a, b) => {
        const aBalanceBN = new BigNumber(a.fiatValue ?? '0');
        const bBalanceBN = new BigNumber(b.fiatValue ?? '0');
        return bBalanceBN.comparedTo(aBalanceBN);
      });
    const noPriceTokens = tokens
      .filter((token) => {
        const priceBN = new BigNumber(token.price ?? '0');
        return priceBN.isNaN() || priceBN.isZero();
      })
      ?.sort((a, b) => {
        const aBalanceBN = new BigNumber(a.fiatValue ?? '0');
        const bBalanceBN = new BigNumber(b.fiatValue ?? '0');
        return bBalanceBN.comparedTo(aBalanceBN);
      });
    return [...havePriceTokens, ...noPriceTokens];
  }, []);

  const mergedAllNetworkTokenList = useCallback(
    ({
      swapAllNetRecommend,
      swapSearchTokens,
    }: {
      swapAllNetRecommend?: ISwapToken[];
      swapSearchTokens?: ISwapToken[];
    }) => {
      const allNetworkTokenList =
        swapAllNetworkTokenList?.filter((token) => {
          const swapNet = swapNetworks.find(
            (net) => net.networkId === token.networkId,
          );
          if (swapNet) {
            return true;
          }
          return false;
        }) ?? [];
      const haveBalanceTokenList =
        allNetworkTokenList?.filter((token) => {
          const balanceBN = new BigNumber(token?.balanceParsed ?? '0');
          if (!balanceBN.isNaN() && !balanceBN.isZero()) {
            return true;
          }
          return false;
        }) ?? [];
      if (swapAllNetRecommend) {
        const filterRecommendTokenList =
          swapAllNetRecommend?.filter(
            (token) =>
              !haveBalanceTokenList?.find(
                (balanceToken) =>
                  balanceToken?.contractAddress === token?.contractAddress &&
                  balanceToken?.networkId === token?.networkId,
              ),
          ) ?? [];
        const allNetTokens = [
          ...haveBalanceTokenList,
          ...filterRecommendTokenList,
        ];
        return sortAllNetworkTokens(allNetTokens ?? []);
      }
      if (swapSearchTokens) {
        const allNetSearchTokens = swapSearchTokens.map((token) => {
          const balanceToken = haveBalanceTokenList.find(
            (walletToken) =>
              walletToken?.contractAddress === token?.contractAddress &&
              walletToken?.networkId === token?.networkId,
          );
          if (balanceToken) {
            return balanceToken;
          }
          return token;
        });
        return sortAllNetworkTokens(allNetSearchTokens ?? []);
      }
      return [];
    },
    [sortAllNetworkTokens, swapAllNetworkTokenList, swapNetworks],
  );

  const fuseRemoteTokensSearch = useFuse(
    networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId }) &&
      keywords
      ? mergedAllNetworkTokenList({
          swapSearchTokens:
            tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
        })
      : tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
    {
      keys: ['symbol'].concat(
        (tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || []).length ===
          1
          ? ['contractAddress']
          : [],
      ),
    },
  );

  const fuseRemoteTokensSearchRef = useRef(fuseRemoteTokensSearch);
  if (fuseRemoteTokensSearchRef.current !== fuseRemoteTokensSearch) {
    fuseRemoteTokensSearchRef.current = fuseRemoteTokensSearch;
  }

  useEffect(() => {
    if (
      tokenFetchParams.accountNetworkId &&
      tokenFetchParams.networkId !== tokenFetchParams.accountNetworkId &&
      !networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
    ) {
      // current network is not the same as account network skip fetch
      return;
    }
    void tokenListFetchAction(tokenFetchParams);
  }, [tokenFetchParams, tokenListFetchAction]);

  useEffect(() => {
    if (
      tokenFetchParams.accountNetworkId &&
      tokenFetchParams.networkId !== tokenFetchParams.accountNetworkId &&
      !networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
    ) {
      return;
    }
    if (keywords && fuseRemoteTokensSearchRef.current) {
      setCurrentTokens(fuseRemoteTokensSearchRef.current.search(keywords));
    } else {
      setCurrentTokens(
        networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
          ? mergedAllNetworkTokenList({
              swapAllNetRecommend:
                tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
            })
          : tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
      );
    }
  }, [
    tokenCatch,
    tokenFetchParams,
    currentNetworkId,
    keywords,
    mergedAllNetworkTokenList,
  ]);

  return {
    fetchLoading:
      (swapTokenFetching && currentTokens.length === 0) ||
      (networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId }) &&
        !swapAllNetworkTokenList),
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
  const [orderFinishCheckBalance, setOrderFinishCheckBalance] = useState(0);
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { loadSwapSelectTokenDetail } = useSwapActions().current;
  const swapHistoryPendingListRef = useRef(swapHistoryPendingList);
  if (swapHistoryPendingListRef.current !== swapHistoryPendingList) {
    swapHistoryPendingListRef.current = swapHistoryPendingList;
  }
  const orderFinishCheckBalanceRef = useRef(orderFinishCheckBalance);
  if (orderFinishCheckBalanceRef.current !== orderFinishCheckBalance) {
    orderFinishCheckBalanceRef.current = orderFinishCheckBalance;
  }
  const swapAddressInfoRef =
    useRef<ReturnType<typeof useSwapAddressInfo>>(swapAddressInfo);
  if (swapAddressInfoRef.current !== swapAddressInfo) {
    swapAddressInfoRef.current = swapAddressInfo;
  }
  const isFocused = useIsFocused();
  const isFocusRef = useRef(isFocused);
  if (isFocusRef.current !== isFocused) {
    isFocusRef.current = isFocused;
  }
  useEffect(() => {
    if (!isFocusRef.current) return;
    if (swapHistoryPendingList.length) {
      const successOrder = swapHistoryPendingList.filter(
        (item) => item.status === ESwapTxHistoryStatus.SUCCESS,
      ).length;
      if (successOrder > orderFinishCheckBalanceRef.current) {
        void loadSwapSelectTokenDetail(type, swapAddressInfoRef.current, true);
        setOrderFinishCheckBalance(successOrder);
      }
    }
  }, [loadSwapSelectTokenDetail, swapHistoryPendingList, type]);

  useEffect(() => {
    void loadSwapSelectTokenDetail(
      type,
      swapAddressInfoRef.current,
      !token?.reservationValue && token?.isNative,
    );
  }, [
    type,
    swapAddressInfo,
    token?.networkId,
    token?.contractAddress,
    loadSwapSelectTokenDetail,
    token?.reservationValue,
    token?.isNative,
  ]);

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageType !== EPageType.modal) {
        if (
          isFocus &&
          !isHiddenModel &&
          swapHistoryPendingListRef.current.length
        ) {
          const successOrder = swapHistoryPendingListRef.current.filter(
            (item) => item.status === ESwapTxHistoryStatus.SUCCESS,
          ).length;
          if (successOrder > orderFinishCheckBalanceRef.current) {
            void loadSwapSelectTokenDetail(
              type,
              swapAddressInfoRef.current,
              true,
            );
            setOrderFinishCheckBalance(successOrder);
          }
        }
      }
    },
  );
}
