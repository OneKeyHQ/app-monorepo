import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';

import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
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
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
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
        params?.importNetworkId !== swapAddressInfoRef.current?.networkId) ||
      !!fromTokenRef.current ||
      !!toTokenRef.current
    ) {
      return;
    }
    const accountNetwork = swapNetworksRef.current.find(
      (net) => net.networkId === swapAddressInfoRef.current?.networkId,
    );
    if (accountNetwork) {
      if (
        !isNil(swapDefaultSetTokens[accountNetwork.networkId]?.fromToken) ||
        !isNil(swapDefaultSetTokens[accountNetwork.networkId]?.toToken)
      ) {
        const defaultFromToken =
          swapDefaultSetTokens[accountNetwork.networkId]?.fromToken;
        const defaultToToken =
          swapDefaultSetTokens[accountNetwork.networkId]?.toToken;
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

  const fuseRemoteTokensSearch = useFuse(
    tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
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
      tokenFetchParams.networkId !== tokenFetchParams.accountNetworkId
    ) {
      return;
    }
    if (keywords && fuseRemoteTokensSearchRef.current) {
      setCurrentTokens(fuseRemoteTokensSearchRef.current.search(keywords));
    } else {
      setCurrentTokens(
        tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
      );
    }
  }, [tokenCatch, tokenFetchParams, currentNetworkId, keywords]);

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
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { loadSwapSelectTokenDetail } = useSwapActions().current;
  const swapAddressInfoRef =
    useRef<ReturnType<typeof useSwapAddressInfo>>(swapAddressInfo);
  if (swapAddressInfoRef.current !== swapAddressInfo) {
    swapAddressInfoRef.current = swapAddressInfo;
  }

  useEffect(() => {
    if (
      swapHistoryPendingList.length &&
      swapHistoryPendingList.some(
        (item) => item.status === ESwapTxHistoryStatus.SUCCESS,
      )
    ) {
      void loadSwapSelectTokenDetail(type, swapAddressInfoRef.current, true);
    }
  }, [loadSwapSelectTokenDetail, swapHistoryPendingList, type]);

  useEffect(() => {
    void loadSwapSelectTokenDetail(type, swapAddressInfoRef.current);
  }, [
    type,
    swapAddressInfo,
    token?.networkId,
    token?.contractAddress,
    loadSwapSelectTokenDetail,
  ]);
}
