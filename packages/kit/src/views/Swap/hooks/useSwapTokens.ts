import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';

import { useIsOverlayPage } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  buildSwapAllNetworkTokenListCacheKey,
  filterTokenSelectorTokensByBackendIndexedNetworks,
  isTokenSelectorDappTokenFilterSupportedNetworkBase,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ESwapCrossChainStatus,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapAllNetworkTokenListMapAtom,
  useSwapNetworksAtom,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectTokenNetworkAtom,
  useSwapTokenFetchingAtom,
  useSwapTokenMapAtom,
} from '../../../states/jotai/contexts/swap';
import {
  buildSwapNetworkReadyKey,
  isSwapNetworkCacheCompatible,
  isSwapNetworkCacheReadyForBasicList,
} from '../utils/swapNetworkCacheUtils';

import { useSwapAddressInfo } from './useSwapAccount';
import { shouldUseSwapAddressForTokenFetch } from './useSwapAccount.utils';

export function useSwapTokenList(
  selectTokenModalType: ESwapDirectionType,
  currentNetworkId?: string,
  keywords?: string,
  from?: ESwapTabSwitchType,
  lpToken?: boolean,
) {
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const [swapAllNetworkTokenListMap] = useSwapAllNetworkTokenListMapAtom();
  const swapSupportAllAccountsRef = useRef<IAllNetworkAccountInfo[]>([]);
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapSupportAllNetworks] = useSwapNetworksIncludeAllNetworkAtom();
  const { tokenListFetchAction, swapLoadAllNetworkTokenList } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [swapTokenFetching] = useSwapTokenFetchingAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const [lpTokenRequestLoading, setLpTokenRequestLoading] = useState(false);
  const latestLpTokenRef = useRef(lpToken);
  const searchLogStateRef = useRef<{
    key: string;
    phase: 'idle' | 'fetching' | 'done';
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const { swapSupportAccounts } =
        await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId: swapAddressInfo?.accountInfo?.indexedAccount?.id,
          otherWalletTypeAccountId: !swapAddressInfo?.accountInfo
            ?.indexedAccount?.id
            ? (swapAddressInfo?.accountInfo?.account?.id ??
              swapAddressInfo?.accountInfo?.dbAccount?.id)
            : undefined,
          swapSupportNetworks: swapNetworks,
        });
      swapSupportAllAccountsRef.current = swapSupportAccounts;
    })();
  }, [
    swapAddressInfo?.accountInfo?.account?.id,
    swapAddressInfo?.accountInfo?.dbAccount?.id,
    swapAddressInfo?.accountInfo?.indexedAccount?.id,
    swapNetworks,
  ]);

  const tokenFetchParams = useMemo(() => {
    const targetNetworkId = currentSelectNetwork?.networkId ?? currentNetworkId;
    const findNetInfo = swapSupportAllAccountsRef.current.find(
      (net) => net.networkId === targetNetworkId,
    );
    const shouldUseCurrentAccountAddress = shouldUseSwapAddressForTokenFetch({
      address: swapAddressInfo?.address,
      activeNetworkId: swapAddressInfo?.activeAccount?.network?.id,
      resolvedAddressNetworkId: swapAddressInfo.networkId,
      targetNetworkId,
    });
    if (findNetInfo?.apiAddress) {
      return {
        networkId: targetNetworkId,
        keywords,
        accountAddress: findNetInfo.apiAddress,
        accountNetworkId: findNetInfo.networkId,
        accountId: findNetInfo.accountId,
        lpToken,
      };
    }

    if (shouldUseCurrentAccountAddress) {
      return {
        networkId: targetNetworkId,
        keywords,
        accountAddress: swapAddressInfo?.address,
        accountNetworkId: swapAddressInfo?.networkId,
        accountId: swapAddressInfo?.accountInfo?.account?.id,
        lpToken,
      };
    }
    return {
      networkId: targetNetworkId,
      keywords,
      accountAddress: findNetInfo?.apiAddress,
      accountNetworkId: findNetInfo?.networkId,
      accountId: findNetInfo?.accountId,
      lpToken,
    };
  }, [
    currentNetworkId,
    swapAddressInfo.networkId,
    swapAddressInfo?.address,
    swapAddressInfo?.activeAccount?.network?.id,
    swapAddressInfo?.accountInfo?.account?.id,
    keywords,
    currentSelectNetwork?.networkId,
    lpToken,
  ]);
  const isTokenFetchAllNetworks = networkUtils.isAllNetwork({
    networkId: tokenFetchParams.networkId,
  });
  const allNetworkTokenListReady = useMemo(() => {
    if (!isTokenFetchAllNetworks) {
      return true;
    }
    if (lpToken) {
      return isSwapNetworkCacheCompatible(swapNetworks);
    }
    return isSwapNetworkCacheReadyForBasicList(swapNetworks);
  }, [isTokenFetchAllNetworks, lpToken, swapNetworks]);
  const allNetworkSwapNetworksReadyKey = useMemo(
    () =>
      isTokenFetchAllNetworks ? buildSwapNetworkReadyKey(swapNetworks) : '',
    [isTokenFetchAllNetworks, swapNetworks],
  );
  const tokenListFetchEffectKey = useMemo(
    () =>
      JSON.stringify({
        tokenFetchParams,
        allNetworkSwapNetworksReadyKey: isTokenFetchAllNetworks
          ? allNetworkSwapNetworksReadyKey
          : undefined,
        allNetworkIndexedAccountId: isTokenFetchAllNetworks
          ? swapAddressInfo?.accountInfo?.indexedAccount?.id
          : undefined,
        allNetworkOtherWalletTypeAccountId: isTokenFetchAllNetworks
          ? (swapAddressInfo?.accountInfo?.account?.id ??
            swapAddressInfo?.accountInfo?.dbAccount?.id)
          : undefined,
      }),
    [
      allNetworkSwapNetworksReadyKey,
      isTokenFetchAllNetworks,
      swapAddressInfo?.accountInfo?.account?.id,
      swapAddressInfo?.accountInfo?.dbAccount?.id,
      swapAddressInfo?.accountInfo?.indexedAccount?.id,
      tokenFetchParams,
    ],
  );
  const latestTokenListFetchEffectKeyRef = useRef('');

  const swapAllNetworkTokenListCacheKey = useMemo(
    () =>
      buildSwapAllNetworkTokenListCacheKey({
        accountId:
          swapAddressInfo?.accountInfo?.indexedAccount?.id ??
          swapAddressInfo?.accountInfo?.account?.id ??
          swapAddressInfo?.accountInfo?.dbAccount?.id ??
          'noAccountId',
        lpToken,
      }),
    [
      lpToken,
      swapAddressInfo?.accountInfo?.indexedAccount?.id,
      swapAddressInfo?.accountInfo?.account?.id,
      swapAddressInfo?.accountInfo?.dbAccount?.id,
    ],
  );

  const swapAllNetworkTokenList = useMemo(
    () => swapAllNetworkTokenListMap[swapAllNetworkTokenListCacheKey],
    [swapAllNetworkTokenListMap, swapAllNetworkTokenListCacheKey],
  );
  const sortAllNetworkTokens = useCallback((tokens: ISwapToken[]) => {
    const havePriceTokens = tokens
      .filter((token) => {
        const priceBN = new BigNumber(token.price ?? '0');
        return !priceBN.isNaN() && !priceBN.isZero();
      })
      ?.toSorted((a, b) => {
        const aBalanceBN = new BigNumber(a.fiatValue ?? '0');
        const bBalanceBN = new BigNumber(b.fiatValue ?? '0');
        return bBalanceBN.comparedTo(aBalanceBN);
      });
    const noPriceTokens = tokens
      .filter((token) => {
        const priceBN = new BigNumber(token.price ?? '0');
        return priceBN.isNaN() || priceBN.isZero();
      })
      ?.toSorted((a, b) => {
        const aBalanceBN = new BigNumber(a.fiatValue ?? '0');
        const bBalanceBN = new BigNumber(b.fiatValue ?? '0');
        return bBalanceBN.comparedTo(aBalanceBN);
      });
    return [...havePriceTokens, ...noPriceTokens];
  }, []);
  const filterSupportedAllNetworkTokens = useCallback(
    (tokens: ISwapToken[]) => {
      const supportedTokens = tokens.filter((token) =>
        swapSupportAllNetworks.find((net) => net.networkId === token.networkId),
      );
      if (!lpToken) {
        return supportedTokens;
      }
      return filterTokenSelectorTokensByBackendIndexedNetworks({
        tokens: supportedTokens,
        backendIndexedNetworkIds: swapSupportAllNetworks
          .filter(isTokenSelectorDappTokenFilterSupportedNetworkBase)
          .map((net) => net.networkId),
      });
    },
    [lpToken, swapSupportAllNetworks],
  );

  const mergedAllNetworkTokenList = useCallback(
    ({
      swapAllNetRecommend,
      swapSearchTokens,
    }: {
      swapAllNetRecommend?: ISwapToken[];
      swapSearchTokens?: ISwapToken[];
    }) => {
      if (swapAllNetRecommend?.length && !swapAllNetworkTokenList) {
        return [];
      }
      const allNetworkTokenList = filterSupportedAllNetworkTokens(
        swapAllNetworkTokenList?.map((token) => {
          const swapNet = swapNetworks.find(
            (net) => net.networkId === token.networkId,
          );
          if (swapNet) {
            return { ...token, networkLogoURI: swapNet.logoURI };
          }
          return token;
        }) ?? [],
      );
      const haveBalanceTokenList =
        allNetworkTokenList?.filter((token) => {
          const balanceBN = new BigNumber(token?.balanceParsed ?? '0');
          if (!balanceBN.isNaN() && !balanceBN.isZero()) {
            return true;
          }
          return false;
        }) ?? [];
      if (swapAllNetRecommend) {
        const filterRecommendTokenList = filterSupportedAllNetworkTokens(
          swapAllNetRecommend?.filter(
            (token) =>
              !haveBalanceTokenList?.find((balanceToken) =>
                equalTokenNoCaseSensitive({
                  token1: {
                    networkId: balanceToken?.networkId,
                    contractAddress: balanceToken?.contractAddress,
                  },
                  token2: {
                    networkId: token?.networkId,
                    contractAddress: token?.contractAddress,
                  },
                }),
              ),
          ) ?? [],
        );
        const allNetTokens = [
          ...haveBalanceTokenList,
          ...filterRecommendTokenList,
        ];
        return sortAllNetworkTokens(allNetTokens ?? []);
      }
      if (swapSearchTokens) {
        const allNetSearchTokens = filterSupportedAllNetworkTokens(
          swapSearchTokens.map((token) => {
            const balanceToken = haveBalanceTokenList.find(
              (walletToken) =>
                walletToken?.contractAddress === token?.contractAddress &&
                walletToken?.networkId === token?.networkId,
            );
            if (balanceToken) {
              return balanceToken;
            }

            return token;
          }),
        );
        return sortAllNetworkTokens(allNetSearchTokens ?? []);
      }
      return [];
    },
    [
      filterSupportedAllNetworkTokens,
      sortAllNetworkTokens,
      swapAllNetworkTokenList,
      swapNetworks,
    ],
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
      shouldSort: false,
      keys: ['symbol', 'contractAddress'],
    },
  );

  const fuseRemoteTokensSearchRef = useRef(fuseRemoteTokensSearch);
  if (fuseRemoteTokensSearchRef.current !== fuseRemoteTokensSearch) {
    fuseRemoteTokensSearchRef.current = fuseRemoteTokensSearch;
  }

  useEffect(() => {
    if (latestTokenListFetchEffectKeyRef.current === tokenListFetchEffectKey) {
      return;
    }
    latestTokenListFetchEffectKeyRef.current = tokenListFetchEffectKey;
    const isLpTokenSwitchRequest = latestLpTokenRef.current !== lpToken;
    latestLpTokenRef.current = lpToken;
    if (isLpTokenSwitchRequest) {
      setLpTokenRequestLoading(true);
    }

    void (async () => {
      try {
        await Promise.all([
          tokenFetchParams.networkId &&
          !keywords &&
          isTokenFetchAllNetworks &&
          allNetworkTokenListReady
            ? swapLoadAllNetworkTokenList(
                swapAddressInfo?.accountInfo?.indexedAccount?.id,
                !swapAddressInfo?.accountInfo?.indexedAccount?.id
                  ? (swapAddressInfo?.accountInfo?.account?.id ??
                      swapAddressInfo?.accountInfo?.dbAccount?.id)
                  : undefined,
                lpToken,
              )
            : undefined,
          tokenListFetchAction(tokenFetchParams),
        ]);
      } finally {
        if (
          isLpTokenSwitchRequest &&
          latestTokenListFetchEffectKeyRef.current === tokenListFetchEffectKey
        ) {
          setLpTokenRequestLoading(false);
        }
      }
    })();
  }, [
    swapAddressInfo?.accountInfo?.account?.id,
    swapAddressInfo?.accountInfo?.dbAccount?.id,
    swapAddressInfo?.accountInfo?.indexedAccount?.id,
    allNetworkTokenListReady,
    isTokenFetchAllNetworks,
    swapLoadAllNetworkTokenList,
    tokenFetchParams,
    tokenListFetchEffectKey,
    tokenListFetchAction,
    keywords,
    lpToken,
  ]);

  useEffect(() => {
    if (!keywords) {
      searchLogStateRef.current = null;
      return;
    }
    const queryLength = keywords.length;
    if (queryLength < 1) {
      searchLogStateRef.current = null;
      return;
    }

    const networkId = currentSelectNetwork?.networkId ?? '';
    const key = `${keywords}__${networkId}__${selectTokenModalType}`;

    if (!searchLogStateRef.current || searchLogStateRef.current.key !== key) {
      searchLogStateRef.current = { key, phase: 'idle' };
    }

    const state = searchLogStateRef.current;
    if (!state) {
      return;
    }

    if (swapTokenFetching) {
      if (state.phase !== 'fetching') {
        searchLogStateRef.current = { key, phase: 'fetching' };
      }
      return;
    }

    if (state.phase === 'fetching') {
      const resultCount =
        fuseRemoteTokensSearchRef.current?.search(keywords)?.length ?? 0;

      defaultLogger.swap.tokenSelectorSearch.swapTokenSelectorSearch({
        query: keywords,
        resultCount,
        networkId,
        networkName: currentSelectNetwork?.isAllNetworks
          ? 'All Networks'
          : (currentSelectNetwork?.name ?? ''),
        direction: selectTokenModalType,
        from,
      });

      searchLogStateRef.current = { key, phase: 'done' };
    }
  }, [
    keywords,
    currentSelectNetwork?.networkId,
    currentSelectNetwork?.name,
    currentSelectNetwork?.isAllNetworks,
    from,
    selectTokenModalType,
    swapTokenFetching,
  ]);

  const currentTokens = useMemo(() => {
    if (keywords) {
      return fuseRemoteTokensSearch.search(keywords);
    }

    return networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
      ? mergedAllNetworkTokenList({
          swapAllNetRecommend:
            tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
        })
      : tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [];
  }, [
    fuseRemoteTokensSearch,
    keywords,
    mergedAllNetworkTokenList,
    tokenCatch,
    tokenFetchParams,
  ]);

  return {
    fetchLoading:
      (swapTokenFetching && currentTokens.length === 0) ||
      (networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId }) &&
        (!allNetworkTokenListReady || !swapAllNetworkTokenList)),
    lpTokenRequestLoading,
    currentTokens,
  };
}

/**
 * Manages and updates detailed information for a selected swap token, including balance and status, in response to swap transaction events and focus changes.
 *
 * Triggers token detail reloads when relevant swap transaction history updates occur, and manages event listeners based on modal and tab focus state.
 *
 * @param token - The swap token to manage details for
 * @param type - The swap direction type (`FROM` or `TO`)
 */
export function useSwapSelectedTokenInfo({
  token,
  type,
}: {
  type: ESwapDirectionType;
  token?: ISwapToken;
}) {
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM); // always fetch from account balance
  const swapAddressInfoTo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { loadSwapSelectTokenDetail } = useSwapActions().current;
  const swapHistoryPendingListRef = useRef(swapHistoryPendingList);
  if (swapHistoryPendingListRef.current !== swapHistoryPendingList) {
    swapHistoryPendingListRef.current = swapHistoryPendingList;
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
  const tokenInfoRef = useRef<ISwapToken | undefined>(token);
  if (tokenInfoRef.current !== token) {
    tokenInfoRef.current = token;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadSwapSelectTokenDetailDeb = useCallback(
    debounce((direction, addressInfo, fetchBalance) => {
      void loadSwapSelectTokenDetail(direction, addressInfo, fetchBalance);
    }, 300),
    [],
  );

  const reloadSwapSelectTokenDetail = useCallback(
    ({
      fromToken,
      toToken,
    }: {
      status: ESwapTxHistoryStatus;
      crossChainStatus?: ESwapCrossChainStatus;
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }) => {
      if (
        (type === ESwapDirectionType.FROM &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: fromToken?.networkId,
              contractAddress: fromToken?.contractAddress,
            },
            token2: {
              networkId: tokenInfoRef.current?.networkId,
              contractAddress: tokenInfoRef.current?.contractAddress,
            },
          })) ||
        (type === ESwapDirectionType.TO &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: toToken?.networkId,
              contractAddress: toToken?.contractAddress,
            },
            token2: {
              networkId: tokenInfoRef.current?.networkId,
              contractAddress: tokenInfoRef.current?.contractAddress,
            },
          }))
      ) {
        void loadSwapSelectTokenDetailDeb(
          type,
          swapAddressInfoRef.current,
          true,
        );
      }
    },
    [type, loadSwapSelectTokenDetailDeb],
  );
  const isModalPage = useIsOverlayPage();
  useEffect(() => {
    if (isFocused && isModalPage) {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        reloadSwapSelectTokenDetail,
      );
      appEventBus.on(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        reloadSwapSelectTokenDetail,
      );
    }
  }, [isFocused, isModalPage, reloadSwapSelectTokenDetail]);

  useEffect(() => {
    if (isFocused) {
      void loadSwapSelectTokenDetailDeb(
        type,
        swapAddressInfoRef.current,
        false,
      );
    }
  }, [
    isFocused,
    type,
    swapAddressInfo,
    swapAddressInfoTo.accountInfo?.deriveType,
    token?.networkId,
    token?.contractAddress,
    token?.balanceParsed,
    loadSwapSelectTokenDetailDeb,
    token?.reservationValue,
    token?.isNative,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (!isModalPage) {
        if (isFocus) {
          appEventBus.off(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
          appEventBus.on(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
        } else if (isHiddenModel) {
          appEventBus.off(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
        } else {
          appEventBus.off(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
          appEventBus.on(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
        }
      }
    },
  );
}
