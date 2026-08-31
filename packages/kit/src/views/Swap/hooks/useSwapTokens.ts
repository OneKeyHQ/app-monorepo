import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';

import { useIsOverlayPage } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
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
  ISwapNetwork,
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
import {
  getSwapAnalyticsTokenListType,
  getSwapAnalyticsTokenRole,
} from '../utils/swapStockAnalytics';

import { buildSwapTokenFetchParams } from './swapTokenFetchParamsUtils';
import { useSwapAddressInfo } from './useSwapAccount';
import { shouldUseSwapAddressForTokenFetch } from './useSwapAccount.utils';
import {
  buildServerAuthoritativeSearchResults,
  releaseSwapTokenListFetchEffectKey,
} from './useSwapTokens.utils';

const EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS: IAllNetworkAccountInfo[] = [];
const EMPTY_SWAP_TOKEN_LIST: ISwapToken[] = [];
const swapSupportAllAccountsCache = new LRUCache<
  string,
  IAllNetworkAccountInfo[]
>({ max: 20 });

appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, () => {
  swapSupportAllAccountsCache.clear();
});

export function useSwapTokenList(
  selectTokenModalType: ESwapDirectionType,
  currentNetworkId?: string,
  keywords?: string,
  from?: ESwapTabSwitchType,
  lpToken?: boolean,
  analyticsOverride?: {
    tokenRole?: string;
    tokenListType?: string;
  },
  supportNetworksOverride?: ISwapNetwork[],
) {
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const [swapAllNetworkTokenListMap] = useSwapAllNetworkTokenListMapAtom();
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapSupportAllNetworksBase] = useSwapNetworksIncludeAllNetworkAtom();
  const swapSupportAllNetworks =
    supportNetworksOverride ?? swapSupportAllNetworksBase;
  const { tokenListFetchAction, swapLoadAllNetworkTokenList } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [swapTokenFetching] = useSwapTokenFetchingAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [lpTokenRequestLoading, setLpTokenRequestLoading] = useState(false);
  const requestCurrency = currencyInfo.id;
  const latestLpTokenRef = useRef(lpToken);
  const lpTokenRequestLoadingRef = useRef(false);
  const indexedAccountId = swapAddressInfo?.accountInfo?.indexedAccount?.id;
  const otherWalletTypeAccountId = !indexedAccountId
    ? (swapAddressInfo?.accountInfo?.account?.id ??
      swapAddressInfo?.accountInfo?.dbAccount?.id)
    : undefined;
  const swapSupportAllAccountsCacheKey = useMemo(
    () =>
      [
        indexedAccountId ?? '',
        otherWalletTypeAccountId ?? '',
        swapSupportAllNetworks.map((network) => network.networkId).join(','),
      ].join('__'),
    [indexedAccountId, otherWalletTypeAccountId, swapSupportAllNetworks],
  );
  const swapSupportAllAccountsRequestKey = useMemo(
    () =>
      [swapSupportAllAccountsCacheKey, swapAddressInfo.deriveType ?? ''].join(
        '__',
      ),
    [swapAddressInfo.deriveType, swapSupportAllAccountsCacheKey],
  );
  const swapSupportAllAccountsReadCacheKey =
    swapAddressInfo.deriveType === undefined
      ? swapSupportAllAccountsCacheKey
      : swapSupportAllAccountsRequestKey;
  const cachedSwapSupportAllAccounts = swapSupportAllAccountsCache.get(
    swapSupportAllAccountsReadCacheKey,
  );
  const [swapSupportAllAccountsState, setSwapSupportAllAccountsState] =
    useState<{
      requestKey: string;
      accounts: IAllNetworkAccountInfo[];
    }>(() => ({
      requestKey:
        cachedSwapSupportAllAccounts !== undefined
          ? swapSupportAllAccountsRequestKey
          : '',
      accounts: cachedSwapSupportAllAccounts ?? EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS,
    }));
  const hasCurrentSupportAccountsState =
    swapSupportAllAccountsState.requestKey === swapSupportAllAccountsRequestKey;
  const isSwapSupportAllAccountsReady =
    hasCurrentSupportAccountsState ||
    cachedSwapSupportAllAccounts !== undefined;
  const swapSupportAllAccounts = hasCurrentSupportAccountsState
    ? swapSupportAllAccountsState.accounts
    : (cachedSwapSupportAllAccounts ?? EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS);
  const searchLogStateRef = useRef<{
    key: string;
    phase: 'idle' | 'fetching' | 'done';
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      try {
        const { swapSupportAccounts } =
          await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
            indexedAccountId,
            otherWalletTypeAccountId,
            swapSupportNetworks: swapSupportAllNetworks,
          });
        if (!isCancelled) {
          swapSupportAllAccountsCache.set(
            swapSupportAllAccountsRequestKey,
            swapSupportAccounts,
          );
          swapSupportAllAccountsCache.set(
            swapSupportAllAccountsCacheKey,
            swapSupportAccounts,
          );
          setSwapSupportAllAccountsState({
            requestKey: swapSupportAllAccountsRequestKey,
            accounts: swapSupportAccounts,
          });
        }
      } catch {
        if (
          !isCancelled &&
          swapSupportAllAccountsCache.get(
            swapSupportAllAccountsReadCacheKey,
          ) === undefined
        ) {
          setSwapSupportAllAccountsState({
            requestKey: swapSupportAllAccountsRequestKey,
            accounts: EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS,
          });
        }
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [
    indexedAccountId,
    otherWalletTypeAccountId,
    swapAddressInfo.deriveType,
    swapSupportAllAccountsCacheKey,
    swapSupportAllAccountsReadCacheKey,
    swapSupportAllAccountsRequestKey,
    swapSupportAllNetworks,
  ]);

  const tokenFetchParams = useMemo(() => {
    const targetNetworkId = currentSelectNetwork?.networkId ?? currentNetworkId;
    const findNetInfo = swapSupportAllAccounts.find(
      (net) => net.networkId === targetNetworkId,
    );
    const shouldUseCurrentAccountAddress = shouldUseSwapAddressForTokenFetch({
      address: swapAddressInfo?.address,
      activeNetworkId: swapAddressInfo?.activeAccount?.network?.id,
      resolvedAddressNetworkId: swapAddressInfo.networkId,
      targetNetworkId,
    });
    return buildSwapTokenFetchParams({
      currentNetworkId,
      currentSelectNetworkId: currentSelectNetwork?.networkId,
      keywords,
      swapType: from,
      lpToken,
      requestCurrency,
      matchedAccount: findNetInfo,
      shouldUseCurrentAccountAddress,
      currentAccountAddress: swapAddressInfo?.address,
      currentAccountNetworkId: swapAddressInfo?.networkId,
      currentAccountId: swapAddressInfo?.accountInfo?.account?.id,
    });
  }, [
    currentNetworkId,
    from,
    swapAddressInfo.networkId,
    swapAddressInfo?.address,
    swapAddressInfo?.activeAccount?.network?.id,
    swapAddressInfo?.accountInfo?.account?.id,
    swapSupportAllAccounts,
    keywords,
    currentSelectNetwork?.networkId,
    lpToken,
    requestCurrency,
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
  const tokenListFetchEffectKey = useMemo(() => {
    const shouldIncludeAllNetworkAccountKey = isTokenFetchAllNetworks;
    const allNetworkIndexedAccountId = shouldIncludeAllNetworkAccountKey
      ? swapAddressInfo?.accountInfo?.indexedAccount?.id
      : undefined;
    const allNetworkOtherWalletTypeAccountId = shouldIncludeAllNetworkAccountKey
      ? (swapAddressInfo?.accountInfo?.account?.id ??
        swapAddressInfo?.accountInfo?.dbAccount?.id)
      : undefined;

    return JSON.stringify({
      tokenFetchParams,
      allNetworkSwapNetworksReadyKey: isTokenFetchAllNetworks
        ? allNetworkSwapNetworksReadyKey
        : undefined,
      allNetworkIndexedAccountId,
      allNetworkOtherWalletTypeAccountId,
    });
  }, [
    allNetworkSwapNetworksReadyKey,
    isTokenFetchAllNetworks,
    swapAddressInfo?.accountInfo?.account?.id,
    swapAddressInfo?.accountInfo?.dbAccount?.id,
    swapAddressInfo?.accountInfo?.indexedAccount?.id,
    tokenFetchParams,
  ]);
  const latestTokenListFetchEffectKeyRef = useRef('');
  const [settledTokenListFetchEffectKey, setSettledTokenListFetchEffectKey] =
    useState('');

  const swapAllNetworkTokenListCacheKey = useMemo(
    () =>
      buildSwapAllNetworkTokenListCacheKey({
        accountId:
          swapAddressInfo?.accountInfo?.indexedAccount?.id ??
          swapAddressInfo?.accountInfo?.account?.id ??
          swapAddressInfo?.accountInfo?.dbAccount?.id ??
          'noAccountId',
        lpToken,
        currency: requestCurrency,
        protocol: from,
      }),
    [
      from,
      lpToken,
      requestCurrency,
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
              return {
                ...balanceToken,
                subtitles: token.subtitles ?? balanceToken.subtitles,
              };
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

  const remoteKeywordSearchTokens = useMemo(
    () =>
      tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data ??
      EMPTY_SWAP_TOKEN_LIST,
    [tokenCatch, tokenFetchParams],
  );

  const keywordSearchTokens = useMemo(
    () =>
      isTokenFetchAllNetworks && keywords
        ? mergedAllNetworkTokenList({
            swapSearchTokens: remoteKeywordSearchTokens,
          })
        : remoteKeywordSearchTokens,
    [
      isTokenFetchAllNetworks,
      keywords,
      mergedAllNetworkTokenList,
      remoteKeywordSearchTokens,
    ],
  );

  const fuseRemoteTokensSearch = useFuse(keywordSearchTokens, {
    shouldSort: false,
    keys: ['symbol', 'name', 'contractAddress', 'subtitles'],
  });

  const currentTokensRef = useRef<(ISwapToken | IFuseResult<ISwapToken>)[]>([]);

  useEffect(() => {
    if (!isSwapSupportAllAccountsReady) {
      return;
    }
    if (latestTokenListFetchEffectKeyRef.current === tokenListFetchEffectKey) {
      return;
    }
    latestTokenListFetchEffectKeyRef.current = tokenListFetchEffectKey;
    const isLpTokenSwitchRequest = latestLpTokenRef.current !== lpToken;
    latestLpTokenRef.current = lpToken;
    if (isLpTokenSwitchRequest) {
      lpTokenRequestLoadingRef.current = true;
      setLpTokenRequestLoading(true);
    }

    let isCancelled = false;
    let isRequestSettled = false;
    void (async () => {
      try {
        await Promise.all([
          tokenFetchParams.networkId &&
          !keywords &&
          isTokenFetchAllNetworks &&
          allNetworkTokenListReady
            ? swapLoadAllNetworkTokenList(
                indexedAccountId,
                otherWalletTypeAccountId,
                lpToken,
                requestCurrency,
              )
            : undefined,
          tokenListFetchAction(tokenFetchParams),
        ]);
      } finally {
        isRequestSettled = true;
        if (
          !isCancelled &&
          latestTokenListFetchEffectKeyRef.current === tokenListFetchEffectKey
        ) {
          setSettledTokenListFetchEffectKey(tokenListFetchEffectKey);
        }
        if (
          !isCancelled &&
          lpTokenRequestLoadingRef.current &&
          latestTokenListFetchEffectKeyRef.current === tokenListFetchEffectKey
        ) {
          lpTokenRequestLoadingRef.current = false;
          setLpTokenRequestLoading(false);
        }
      }
    })();
    return () => {
      isCancelled = true;
      if (!isRequestSettled) {
        latestTokenListFetchEffectKeyRef.current =
          releaseSwapTokenListFetchEffectKey({
            effectKey: tokenListFetchEffectKey,
            latestEffectKey: latestTokenListFetchEffectKeyRef.current,
          });
      }
    };
  }, [
    indexedAccountId,
    otherWalletTypeAccountId,
    allNetworkTokenListReady,
    isSwapSupportAllAccountsReady,
    isTokenFetchAllNetworks,
    swapLoadAllNetworkTokenList,
    tokenFetchParams,
    tokenListFetchEffectKey,
    tokenListFetchAction,
    keywords,
    lpToken,
    requestCurrency,
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
    const key = [
      keywords,
      networkId,
      selectTokenModalType,
      analyticsOverride?.tokenRole ?? '',
      analyticsOverride?.tokenListType ?? '',
    ].join('__');

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
      const resultCount = currentTokensRef.current.length;

      defaultLogger.swap.tokenSelectorSearch.swapTokenSelectorSearch({
        query: keywords,
        resultCount,
        networkId,
        networkName: currentSelectNetwork?.isAllNetworks
          ? 'All Networks'
          : (currentSelectNetwork?.name ?? ''),
        network: currentSelectNetwork?.isAllNetworks
          ? 'All Networks'
          : (currentSelectNetwork?.name ?? networkId),
        direction: selectTokenModalType,
        from,
        tokenRole:
          analyticsOverride?.tokenRole ??
          getSwapAnalyticsTokenRole(selectTokenModalType),
        tokenListType:
          analyticsOverride?.tokenListType ??
          getSwapAnalyticsTokenListType({ from }),
      });

      searchLogStateRef.current = { key, phase: 'done' };
    }
  }, [
    keywords,
    currentSelectNetwork?.networkId,
    currentSelectNetwork?.name,
    currentSelectNetwork?.isAllNetworks,
    from,
    analyticsOverride?.tokenListType,
    analyticsOverride?.tokenRole,
    selectTokenModalType,
    swapTokenFetching,
  ]);

  const isTokenListFetchSettled =
    settledTokenListFetchEffectKey === tokenListFetchEffectKey;
  const tokenListCacheKey = JSON.stringify(tokenFetchParams);
  const tokenListCacheEntry = tokenCatch?.[tokenListCacheKey];
  const unfilteredTokens = useMemo(() => {
    if (!isSwapSupportAllAccountsReady) {
      return [];
    }
    if (keywords) {
      return [];
    }
    return networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
      ? mergedAllNetworkTokenList({
          swapAllNetRecommend: tokenListCacheEntry?.data || [],
        })
      : tokenListCacheEntry?.data || [];
  }, [
    keywords,
    mergedAllNetworkTokenList,
    tokenListCacheEntry,
    tokenFetchParams.networkId,
    isSwapSupportAllAccountsReady,
  ]);
  const currentTokens = useMemo(() => {
    if (!isSwapSupportAllAccountsReady) {
      return [];
    }
    if (!keywords) {
      return unfilteredTokens;
    }
    const matchesByToken = new Map(
      fuseRemoteTokensSearch
        .search(keywords)
        .map((result) => [result.item, result.matches]),
    );
    return buildServerAuthoritativeSearchResults(
      keywordSearchTokens,
      matchesByToken,
    );
  }, [
    fuseRemoteTokensSearch,
    isSwapSupportAllAccountsReady,
    keywordSearchTokens,
    keywords,
    unfilteredTokens,
  ]);

  if (currentTokensRef.current !== currentTokens) {
    currentTokensRef.current = currentTokens;
  }

  const isAllNetworkListReady =
    !isTokenFetchAllNetworks ||
    (allNetworkTokenListReady && swapAllNetworkTokenList !== undefined);
  const hasCurrentScopeSnapshot =
    isSwapSupportAllAccountsReady &&
    Boolean(tokenListCacheEntry) &&
    isAllNetworkListReady;
  const fetchLoading =
    !hasCurrentScopeSnapshot &&
    (!isSwapSupportAllAccountsReady ||
      !isTokenListFetchSettled ||
      swapTokenFetching ||
      !isAllNetworkListReady);

  return {
    fetchLoading,
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
  useEffect(
    () => () => {
      loadSwapSelectTokenDetailDeb.cancel();
    },
    [loadSwapSelectTokenDetailDeb],
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
