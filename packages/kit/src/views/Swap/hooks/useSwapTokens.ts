import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  ESwapTxHistoryStatus,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks/useDebounce';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapAllNetworkTokenListMapAtom,
  useSwapAllNetworkTokenListStatusAtom,
  useSwapNetworksAtom,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectTokenNetworkAtom,
  useSwapTokenListRequestsAtom,
  useSwapTokenMapAtom,
} from '../../../states/jotai/contexts/swap';
import {
  buildSwapNetworkReadyKey,
  isSwapNetworkCacheCompatible,
  isSwapNetworkCacheReadyForBasicList,
} from '../utils/swapNetworkCacheUtils';
import { buildSwapProPositionsNetworkIdsKey } from '../utils/swapProPositionsKeyUtils';
import {
  getSwapAnalyticsTokenListType,
  getSwapAnalyticsTokenRole,
} from '../utils/swapStockAnalytics';
import {
  buildSwapTokenListCacheKey,
  getSwapTokenSelectorCacheEpoch,
  isSwapTokenSelectorAccountRemoved,
  subscribeSwapTokenSelectorCache,
} from '../utils/swapTokenSelectorCacheUtils';
import { createSwapTokenSelectorSession } from '../utils/swapTokenSelectorSession';

import {
  buildSwapTokenFetchParams,
  resolveSwapTokenSearchNetworkId,
} from './swapTokenFetchParamsUtils';
import { useSwapAddressInfo } from './useSwapAccount';
import { shouldUseSwapAddressForTokenFetch } from './useSwapAccount.utils';
import {
  buildServerAuthoritativeSearchResults,
  findSwapWalletBalanceToken,
  isSwapSupportAllAccountsRequestCurrent,
  mergeSwapSearchTokenBalance,
  shouldLoadSwapAllNetworkTokenList,
} from './useSwapTokens.utils';

const EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS: IAllNetworkAccountInfo[] = [];
const EMPTY_SWAP_TOKEN_LIST: ISwapToken[] = [];
const swapSupportAllAccountsCache = new LRUCache<
  string,
  IAllNetworkAccountInfo[]
>({ max: 20 });
let swapSupportAllAccountsCacheGeneration = 0;
const swapSupportAllAccountsListeners = new Set<() => void>();
function subscribeSwapSupportAllAccounts(listener: () => void) {
  swapSupportAllAccountsListeners.add(listener);
  return () => {
    swapSupportAllAccountsListeners.delete(listener);
  };
}
function getSwapSupportAllAccountsGeneration() {
  return swapSupportAllAccountsCacheGeneration;
}

function invalidateSwapSupportAllAccounts() {
  swapSupportAllAccountsCacheGeneration += 1;
  swapSupportAllAccountsCache.clear();
  swapSupportAllAccountsListeners.forEach((listener) => listener());
}

appEventBus.on(
  EAppEventBusNames.GlobalDeriveTypeUpdate,
  invalidateSwapSupportAllAccounts,
);
appEventBus.on(EAppEventBusNames.WalletClear, invalidateSwapSupportAllAccounts);
appEventBus.on(
  EAppEventBusNames.WalletRemove,
  invalidateSwapSupportAllAccounts,
);
appEventBus.on(
  EAppEventBusNames.AccountRemove,
  invalidateSwapSupportAllAccounts,
);

export function useSwapTokenSearchKeyword() {
  const [searchIntent, setSearchIntent] = useState({
    keyword: '',
    revision: 0,
  });
  const debouncedIntent = useDebounce(searchIntent, 500);
  const setSearchKeyword = useCallback((text: string) => {
    const keyword = text.trim();
    setSearchIntent((previous) =>
      previous.keyword === keyword
        ? previous
        : { keyword, revision: previous.revision + 1 },
    );
  }, []);
  // A new round can have the same text as an earlier completed search. Debounce
  // the round as well so clearing and retyping cannot reuse the old timer value.
  return {
    searchKeyword: searchIntent.keyword,
    setSearchKeyword,
    requestedSearchKeyword: searchIntent.keyword ? debouncedIntent.keyword : '',
    searchRound: searchIntent.revision,
    isSearchKeywordSettling:
      Boolean(searchIntent.keyword) &&
      searchIntent.revision !== debouncedIntent.revision,
  };
}

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
  searchRound = 0,
  isSearchPending = false,
) {
  const isFocused = useIsFocused();
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const [swapAllNetworkTokenListMap] = useSwapAllNetworkTokenListMapAtom();
  const [swapAllNetworkTokenListStatus] =
    useSwapAllNetworkTokenListStatusAtom();
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapSupportAllNetworksBase] = useSwapNetworksIncludeAllNetworkAtom();
  const swapSupportAllNetworks =
    supportNetworksOverride ?? swapSupportAllNetworksBase;
  const { tokenListFetchAction, swapLoadAllNetworkTokenList } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [tokenListRequests] = useSwapTokenListRequestsAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const requestCurrency = currencyInfo.id;
  const cacheEpoch = useSyncExternalStore(
    subscribeSwapTokenSelectorCache,
    getSwapTokenSelectorCacheEpoch,
    getSwapTokenSelectorCacheEpoch,
  );
  const indexedAccountId = swapAddressInfo?.accountInfo?.indexedAccount?.id;
  const otherWalletTypeAccountId = !indexedAccountId
    ? (swapAddressInfo?.accountInfo?.account?.id ??
      swapAddressInfo?.accountInfo?.dbAccount?.id)
    : undefined;
  const isSelectorAccountRemoved = isSwapTokenSelectorAccountRemoved({
    indexedAccountId,
    accountId: otherWalletTypeAccountId,
  });
  const supportAccountsGeneration = useSyncExternalStore(
    subscribeSwapSupportAllAccounts,
    getSwapSupportAllAccountsGeneration,
    getSwapSupportAllAccountsGeneration,
  );
  const swapSupportAllNetworksRef = useRef(swapSupportAllNetworks);
  useLayoutEffect(() => {
    swapSupportAllNetworksRef.current = swapSupportAllNetworks;
  }, [swapSupportAllNetworks]);
  const swapSupportAllAccountsCacheKey = useMemo(
    () =>
      [
        indexedAccountId ?? '',
        otherWalletTypeAccountId ?? '',
        buildSwapProPositionsNetworkIdsKey(
          swapSupportAllNetworks.map((network) => network.networkId),
        ),
      ].join('__'),
    [indexedAccountId, otherWalletTypeAccountId, swapSupportAllNetworks],
  );
  // Discovery covers the whole wallet; selecting or reordering a chain does
  // not change its accounts. Global derive changes invalidate that scope.
  const swapSupportAllAccountsRequestKey = `${swapSupportAllAccountsCacheKey}__${supportAccountsGeneration}`;
  const swapSupportAllAccountsReadCacheKey = swapSupportAllAccountsCacheKey;
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
    const requestGeneration = swapSupportAllAccountsCacheGeneration;
    void (async () => {
      try {
        if (isSelectorAccountRemoved) {
          setSwapSupportAllAccountsState({
            requestKey: swapSupportAllAccountsRequestKey,
            accounts: EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS,
          });
          return;
        }
        const { swapSupportAccounts, supportAccountsFetchFailed } =
          await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
            indexedAccountId,
            otherWalletTypeAccountId,
            swapSupportNetworks: swapSupportAllNetworksRef.current,
          });
        if (
          isSwapSupportAllAccountsRequestCurrent({
            isCancelled,
            requestGeneration,
            currentGeneration: swapSupportAllAccountsCacheGeneration,
          })
        ) {
          if (!supportAccountsFetchFailed) {
            swapSupportAllAccountsCache.set(
              swapSupportAllAccountsCacheKey,
              swapSupportAccounts,
            );
          }
          setSwapSupportAllAccountsState({
            requestKey: swapSupportAllAccountsRequestKey,
            accounts: supportAccountsFetchFailed
              ? (swapSupportAllAccountsCache.get(
                  swapSupportAllAccountsReadCacheKey,
                ) ?? EMPTY_SWAP_SUPPORT_ALL_ACCOUNTS)
              : swapSupportAccounts,
          });
        }
      } catch {
        if (
          isSwapSupportAllAccountsRequestCurrent({
            isCancelled,
            requestGeneration,
            currentGeneration: swapSupportAllAccountsCacheGeneration,
          }) &&
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
    isSelectorAccountRemoved,
    otherWalletTypeAccountId,
    swapSupportAllAccountsCacheKey,
    swapSupportAllAccountsReadCacheKey,
    swapSupportAllAccountsRequestKey,
  ]);

  const searchNetworkId = resolveSwapTokenSearchNetworkId({
    selectedNetworkId: currentSelectNetwork?.networkId,
    keywords,
    swapType: from,
    allNetworksId: swapSupportAllNetworks.find(
      (network) => network.isAllNetworks,
    )?.networkId,
  });

  const nextTokenFetchParams = useMemo(() => {
    const targetNetworkId = searchNetworkId ?? currentNetworkId;
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
      searchNetworkId,
      searchNetworks: swapSupportAllNetworks
        .filter(
          (network) =>
            !networkUtils.isAllNetwork({ networkId: network.networkId }) &&
            (!lpToken ||
              isTokenSelectorDappTokenFilterSupportedNetworkBase(network)),
        )
        .map((network) => ({
          networkId: network.networkId,
          lpToken: isTokenSelectorDappTokenFilterSupportedNetworkBase(network)
            ? lpToken
            : undefined,
        })),
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
    currentSelectNetwork?.networkId,
    from,
    swapAddressInfo.networkId,
    swapAddressInfo?.address,
    swapAddressInfo?.activeAccount?.network?.id,
    swapAddressInfo?.accountInfo?.account?.id,
    swapSupportAllAccounts,
    swapSupportAllNetworks,
    keywords,
    searchNetworkId,
    lpToken,
    requestCurrency,
  ]);

  const tokenListCacheKey = buildSwapTokenListCacheKey(nextTokenFetchParams);
  const [stableTokenFetchParams, setStableTokenFetchParams] = useState({
    key: tokenListCacheKey,
    params: nextTokenFetchParams,
  });
  if (stableTokenFetchParams.key !== tokenListCacheKey) {
    setStableTokenFetchParams({
      key: tokenListCacheKey,
      params: nextTokenFetchParams,
    });
  }
  // Account discovery can replace objects without changing the request. Keep
  // query identity in state so a discarded concurrent render cannot change the
  // parameters of the committed selector.
  const tokenFetchParams =
    stableTokenFetchParams.key === tokenListCacheKey
      ? stableTokenFetchParams.params
      : nextTokenFetchParams;
  const rawTokenListCacheEntry = tokenCatch?.[tokenListCacheKey];
  const tokenListCacheEntry =
    (rawTokenListCacheEntry?.identityVersion ?? 0) === cacheEpoch.identity
      ? rawTokenListCacheEntry
      : undefined;
  const swapTokenFetching =
    tokenListRequests[tokenListCacheKey]?.identityVersion ===
    cacheEpoch.identity;

  const isTokenFetchAllNetworks = networkUtils.isAllNetwork({
    networkId: tokenFetchParams.networkId,
  });
  const refreshFullChainLists =
    Boolean(platformEnv.isDesktop || platformEnv.isWeb) &&
    from !== ESwapTabSwitchType.STOCK;
  const queryCoveredByWalletRefresh =
    refreshFullChainLists &&
    swapSupportAllAccounts.some(
      (account) =>
        account.networkId === tokenFetchParams.networkId &&
        account.accountId === tokenFetchParams.accountId &&
        account.apiAddress === tokenFetchParams.accountAddress,
    );
  const desktopNetworksReady = lpToken
    ? isSwapNetworkCacheCompatible(swapNetworks)
    : isSwapNetworkCacheReadyForBasicList(swapNetworks);
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
    () => buildSwapNetworkReadyKey(swapNetworks),
    [swapNetworks],
  );
  const sessionScopeKey = JSON.stringify({
    indexedAccountId,
    otherWalletTypeAccountId,
    protocol: from,
    currency: requestCurrency,
    cacheEpoch,
    networks: allNetworkSwapNetworksReadyKey,
  });
  // Chain selection starts a new search intent even when contract searches
  // share the same all-network HTTP identity and in-flight request.
  const selectedSearchNetworkId = keywords
    ? (currentSelectNetwork?.networkId ?? currentNetworkId)
    : undefined;
  const tokenListFetchEffectKey = useMemo(
    () =>
      JSON.stringify({
        tokenListCacheKey,
        cacheEpoch,
        allNetworkSwapNetworksReadyKey,
        indexedAccountId,
        otherWalletTypeAccountId,
        searchRound: keywords ? searchRound : undefined,
        selectedSearchNetworkId,
      }),
    [
      allNetworkSwapNetworksReadyKey,
      indexedAccountId,
      otherWalletTypeAccountId,
      tokenListCacheKey,
      cacheEpoch,
      keywords,
      searchRound,
      selectedSearchNetworkId,
    ],
  );
  const [settledTokenListFetchEffectKey, setSettledTokenListFetchEffectKey] =
    useState('');
  const isTokenListFetchSettled =
    settledTokenListFetchEffectKey === tokenListFetchEffectKey;
  const searchResultKey = keywords ? tokenListFetchEffectKey : '';
  const [searchResponse, setSearchResponse] = useState<{
    requestKey: string;
    tokens: ISwapToken[];
    status: 'pending' | 'success' | 'error';
  }>({
    requestKey: searchResultKey,
    tokens: EMPTY_SWAP_TOKEN_LIST,
    status: 'pending',
  });
  if (searchResponse.requestKey !== searchResultKey) {
    setSearchResponse({
      requestKey: searchResultKey,
      tokens: EMPTY_SWAP_TOKEN_LIST,
      status: 'pending',
    });
  }
  const currentSearchResponse =
    searchResponse.requestKey === searchResultKey ? searchResponse : undefined;
  const searchLoading =
    isSearchPending ||
    !isSwapSupportAllAccountsReady ||
    !currentSearchResponse ||
    currentSearchResponse.status === 'pending';

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

  const swapAllNetworkTokenList =
    (swapAllNetworkTokenListStatus[swapAllNetworkTokenListCacheKey]
      ?.identityVersion ?? 0) === cacheEpoch.identity
      ? swapAllNetworkTokenListMap[swapAllNetworkTokenListCacheKey]
      : undefined;
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
      if (
        swapAllNetRecommend?.length &&
        !swapAllNetworkTokenList &&
        !isTokenListFetchSettled
      ) {
        return [];
      }
      const allNetworkTokenList = filterSupportedAllNetworkTokens(
        swapAllNetworkTokenList?.map((token) => {
          const swapNet = swapNetworks.find(
            (net) => net.networkId === token.networkId,
          );
          if (swapNet && token.networkLogoURI !== swapNet.logoURI) {
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
            const balanceToken = findSwapWalletBalanceToken(
              haveBalanceTokenList,
              token,
            );
            if (balanceToken) {
              return mergeSwapSearchTokenBalance(token, balanceToken);
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
      isTokenListFetchSettled,
      sortAllNetworkTokens,
      swapAllNetworkTokenList,
      swapNetworks,
    ],
  );

  const remoteKeywordSearchTokens = useMemo(
    () =>
      !isSearchPending && currentSearchResponse?.status === 'success'
        ? currentSearchResponse.tokens
        : EMPTY_SWAP_TOKEN_LIST,
    [currentSearchResponse, isSearchPending],
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

  const lastRefreshVersionRef = useRef(cacheEpoch.refresh);
  const [loadSelectorSession] = useState(createSwapTokenSelectorSession);

  // One session coordinates open/event refreshes; actions share HTTP work with
  // the preloader. Chain/search changes do not start another wallet sweep.
  useEffect(() => {
    if (!isFocused) {
      setSettledTokenListFetchEffectKey('');
      return;
    }
    if (
      isSelectorAccountRemoved ||
      !isSwapSupportAllAccountsReady ||
      isSearchPending ||
      (keywords && isTokenFetchAllNetworks && !allNetworkTokenListReady) ||
      (refreshFullChainLists && !desktopNetworksReady)
    ) {
      return;
    }
    setSettledTokenListFetchEffectKey('');
    const hasRefreshEvent =
      lastRefreshVersionRef.current !== cacheEpoch.refresh;
    lastRefreshVersionRef.current = cacheEpoch.refresh;
    let isCancelled = false;
    void (async () => {
      try {
        const refreshWallet =
          refreshFullChainLists ||
          shouldLoadSwapAllNetworkTokenList({
            networkId: tokenFetchParams.networkId,
            keywords,
            isTokenFetchAllNetworks,
            allNetworkTokenListReady,
            forceRefresh: hasRefreshEvent,
          });
        let walletFilters: (boolean | undefined)[] = [];
        if (refreshFullChainLists) {
          walletFilters = lpToken ? [false, true] : [false];
        } else if (refreshWallet) {
          walletFilters = [lpToken];
        }
        await loadSelectorSession({
          scopeKey: sessionScopeKey,
          params: tokenFetchParams,
          walletFilters,
          walletRefreshCoversChainLists: refreshFullChainLists,
          queryCoveredByWalletRefresh,
          isAllNetworks: isTokenFetchAllNetworks,
          isCurrent: () => !isCancelled,
          refreshWallet: (filter) =>
            swapLoadAllNetworkTokenList(
              indexedAccountId,
              otherWalletTypeAccountId,
              filter,
              requestCurrency,
              { policy: 'revalidate' },
            ),
          fetchTokens: tokenListFetchAction,
        }).then(
          (tokens) => {
            if (!isCancelled && keywords) {
              setSearchResponse({
                requestKey: tokenListFetchEffectKey,
                tokens: tokens ?? EMPTY_SWAP_TOKEN_LIST,
                status: tokens === undefined ? 'error' : 'success',
              });
            }
          },
          () => {
            if (!isCancelled && keywords) {
              setSearchResponse({
                requestKey: tokenListFetchEffectKey,
                tokens: EMPTY_SWAP_TOKEN_LIST,
                status: 'error',
              });
            }
          },
        );
      } catch {
        // Failed refreshes preserve the last successful cache entry.
      } finally {
        if (!isCancelled) {
          setSettledTokenListFetchEffectKey(tokenListFetchEffectKey);
        }
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [
    indexedAccountId,
    isSelectorAccountRemoved,
    desktopNetworksReady,
    refreshFullChainLists,
    queryCoveredByWalletRefresh,
    sessionScopeKey,
    loadSelectorSession,
    otherWalletTypeAccountId,
    allNetworkTokenListReady,
    cacheEpoch.refresh,
    isFocused,
    isSearchPending,
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
      searchRound,
    ].join('__');

    if (!searchLogStateRef.current || searchLogStateRef.current.key !== key) {
      searchLogStateRef.current = { key, phase: 'idle' };
    }

    const state = searchLogStateRef.current;
    if (!state) {
      return;
    }

    if (searchLoading) {
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
    searchLoading,
    searchRound,
  ]);

  const unfilteredTokens = useMemo(() => {
    if (!isSwapSupportAllAccountsReady) {
      return [];
    }
    if (keywords) {
      return [];
    }
    const cachedTokens = tokenListCacheEntry?.data;
    if (networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })) {
      return mergedAllNetworkTokenList({
        swapAllNetRecommend: cachedTokens || [],
      });
    }
    if (cachedTokens !== undefined) {
      return cachedTokens;
    }
    // A holdings projection is incomplete. Desktop waits for the full chain
    // snapshot instead of revealing a subset when that snapshot was evicted.
    if (refreshFullChainLists) {
      return EMPTY_SWAP_TOKEN_LIST;
    }
    const networkLogoURI = swapNetworks.find(
      (network) => network.networkId === tokenFetchParams.networkId,
    )?.logoURI;
    // Account-only cached tokens may omit metadata supplied by the full list.
    // Use the already loaded network logo for their first paint as well.
    return (
      swapAllNetworkTokenList?.filter(
        (token) => token.networkId === tokenFetchParams.networkId,
      ) ?? []
    ).map((token) =>
      token.networkLogoURI || !networkLogoURI
        ? token
        : { ...token, networkLogoURI },
    );
  }, [
    keywords,
    mergedAllNetworkTokenList,
    refreshFullChainLists,
    swapAllNetworkTokenList,
    swapNetworks,
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

  useLayoutEffect(() => {
    currentTokensRef.current = currentTokens;
  }, [currentTokens]);

  const isAllNetworkListReady =
    !isTokenFetchAllNetworks ||
    (allNetworkTokenListReady &&
      (swapAllNetworkTokenList !== undefined || isTokenListFetchSettled));
  const hasTokenListSnapshot =
    Boolean(tokenListCacheEntry) || (!keywords && unfilteredTokens.length > 0);
  const hasCurrentScopeSnapshot =
    isSwapSupportAllAccountsReady &&
    hasTokenListSnapshot &&
    isAllNetworkListReady;
  const fetchLoading = keywords
    ? searchLoading
    : !hasCurrentScopeSnapshot &&
      (!isSwapSupportAllAccountsReady ||
        !isTokenListFetchSettled ||
        swapTokenFetching ||
        !isAllNetworkListReady);

  return {
    fetchLoading,
    lpTokenRequestLoading: Boolean(lpToken && fetchLoading),
    currentTokens,
    // Differs from the selected network when an address search was widened.
    searchNetworkId,
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
