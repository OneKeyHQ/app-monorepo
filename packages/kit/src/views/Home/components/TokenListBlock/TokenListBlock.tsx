import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CanceledError } from 'axios';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  IconButton,
  Skeleton,
  Stack,
  XStack,
  onVisibilityStateChange,
  useOnRouterChange,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptyAccount } from '@onekeyhq/kit/src/components/Empty';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import { perfTokenListView } from '@onekeyhq/kit/src/components/TokenListView/perfTokenListView';
import { getTokenListOwnerCacheAccountId } from '@onekeyhq/kit/src/components/TokenListView/utils';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import {
  type IScopedActiveTokenList,
  type IScopedActiveTokenListState,
  buildScopedActiveTokenListFromResponses,
  fetchFilteredTokenSelectorTokens,
} from '@onekeyhq/kit/src/components/TokenSelectorFilter/utils';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  useAccountOverviewActions,
  useAccountWorthAtom,
  useAllNetworksStateStateAtom,
  useOverviewTokenCacheStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { buildOverviewOwnerKey } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview/atoms';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useAllTokenListAtom,
  useRenderedTokenListCacheAtom,
  useTokenListActions,
  useTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ISimpleDBAggregateToken } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAggregateToken';
import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IRiskTokenManagementDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityRiskTokenManagement';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
  POLLING_INTERVAL_FOR_TOKEN,
  TOKEN_LIST_HIGH_VALUE_MAX,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { buildTokenSelectorDappTokenFilterParams } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  buildAggregateTokenListData,
  buildLocalAggregateTokenMapKey,
  calculateAccountTokensValue,
  flattenAggregateTokensMap,
  getEmptyTokenData,
  getMergedDeriveTokenData,
  getMergedTokenData,
  mergeAggregateTokenListMap,
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  mergeNestedAggregateTokenMap,
  nestAggregateTokensMap,
  sortTokensByFiatValue,
  sortTokensByOrder,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { RichBlock } from '../RichBlock/RichBlock';

const networkIdsMap = getNetworkIdsMap();

type ITokenSelectorFilterMode = 'wallet-token' | 'lp-dapp-token';

type IAllNetworkTokenListResp = IFetchAccountTokensResp & {
  tokenSelectorFilterMode: ITokenSelectorFilterMode;
  syncTokenFilterToOverview: boolean;
};

type IActiveAccountTokenListRequestContext = {
  accountId: string;
  indexedAccountId: string;
  networkId: string;
  mergeDeriveAddressData: boolean;
  tokenSelectorFilterMode: ITokenSelectorFilterMode;
};

function buildTokenSelectorFilterMode(
  lpToken: boolean,
): ITokenSelectorFilterMode {
  return lpToken ? 'lp-dapp-token' : 'wallet-token';
}

function isSameActiveAccountTokenListRequestContext(
  a: IActiveAccountTokenListRequestContext,
  b: IActiveAccountTokenListRequestContext,
) {
  return (
    a.accountId === b.accountId &&
    a.indexedAccountId === b.indexedAccountId &&
    a.networkId === b.networkId &&
    a.mergeDeriveAddressData === b.mergeDeriveAddressData &&
    a.tokenSelectorFilterMode === b.tokenSelectorFilterMode
  );
}

function TokenListBlock({
  tableLayout,
  showRecentHistory,
}: {
  tableLayout?: boolean;
  showRecentHistory?: boolean;
}) {
  const [settings] = useSettingsPersistAtom();

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();
  // Outer-route focus: false when user is on Market/Swap (Home tab inactive),
  // when a modal is presented above Home, or when the app is locked. Combined
  // below with `isFocused` (inner Home-tab) so app-resume only refreshes when
  // the user is actually looking at this list.
  const isRouteFocused = useRouteIsFocused();

  const {
    activeAccount: {
      account,
      accountName,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveInfo,
      deriveType,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });
  const [shouldAlwaysFetch, setShouldAlwaysFetch] = useState(false);
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const showLpTokensOnly = tokenSelectorFilter.homeShowLpTokensOnly;
  const [scopedLpTokenList, setScopedLpTokenList] =
    useState<IScopedActiveTokenList>({
      tokens: [],
      keys: '',
    });
  const [scopedLpTokenListMap, setScopedLpTokenListMap] = useState<
    Record<string, ITokenFiat>
  >({});
  const [scopedLpTokenListState, setScopedLpTokenListState] =
    useState<IScopedActiveTokenListState>({
      isRefreshing: false,
      initialized: false,
    });
  const [tokenListState] = useTokenListStateAtom();
  const [allNetworkAccounts, setAllNetworkAccounts] = useState<
    IAllNetworkAccountInfo[] | undefined
  >(undefined);
  const intl = useIntl();

  const mergeDeriveAddressData =
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1;

  const [accountTokensWorth] = useAccountWorthAtom();
  const [, setOverviewTokenCacheState] = useOverviewTokenCacheStateAtom();

  const walletTokenFilterParams = useMemo(
    () =>
      buildTokenSelectorDappTokenFilterParams({
        lpToken: false,
      }),
    [],
  );
  const tokenSelectorFilterParams = useMemo(
    () =>
      buildTokenSelectorDappTokenFilterParams({
        lpToken: showLpTokensOnly,
      }),
    [showLpTokensOnly],
  );
  const tokenSelectorFilterMode =
    buildTokenSelectorFilterMode(showLpTokensOnly);
  const latestTokenSelectorFilterModeRef = useRef(tokenSelectorFilterMode);
  latestTokenSelectorFilterModeRef.current = tokenSelectorFilterMode;
  const latestActiveAccountTokenListRequestContextRef =
    useRef<IActiveAccountTokenListRequestContext>({
      accountId: account?.id ?? '',
      indexedAccountId: indexedAccount?.id ?? '',
      networkId: network?.id ?? '',
      mergeDeriveAddressData: !!mergeDeriveAddressData,
      tokenSelectorFilterMode,
    });
  latestActiveAccountTokenListRequestContextRef.current = {
    accountId: account?.id ?? '',
    indexedAccountId: indexedAccount?.id ?? '',
    networkId: network?.id ?? '',
    mergeDeriveAddressData: !!mergeDeriveAddressData,
    tokenSelectorFilterMode,
  };
  const refreshWalletTokenListRef = useRef<
    ((options?: { forceWalletTokenMode?: boolean }) => void) | undefined
  >(undefined);
  const syncTokenFilterToOverview = true;

  const accountTokensValue = useMemo(() => {
    return calculateAccountTokensValue({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      tokensWorth: accountTokensWorth,
      mergeDeriveAssetsEnabled: !!vaultSettings?.mergeDeriveAssetsEnabled,
    });
  }, [
    account?.id,
    network?.id,
    accountTokensWorth,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const tokenListRef = useRef<{
    keys: string;
    tokens: IAccountToken[];
    map: { [key: string]: ITokenFiat };
  }>({
    keys: '',
    tokens: [],
    map: {},
  });

  const riskyTokenListRef = useRef<{
    keys: string;
    tokens: IAccountToken[];
    map: { [key: string]: ITokenFiat };
  }>({
    keys: '',
    tokens: [],
    map: {},
  });

  const riskTokenManagementRawData = useRef<IRiskTokenManagementDBStruct>({
    unblockedTokens: {},
    blockedTokens: {},
  });

  const customTokensRawData = useRef<ICustomTokenDBStruct | undefined>(
    undefined,
  );

  const localTokensRawData = useRef<ISimpleDBLocalTokens | undefined>(
    undefined,
  );

  const aggregateTokenRawData = useRef<ISimpleDBAggregateToken | undefined>(
    undefined,
  );

  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });

  const navigation = useAppNavigation();

  useOnRouterChange((state) => {
    const modalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.Modal,
    );

    if (
      // @ts-ignore
      (modalRoutes?.params?.screen === EModalRoutes.SignatureConfirmModal &&
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        modalRoutes?.params?.params?.screen ===
          EModalSignatureConfirmRoutes.TxSelectToken) ||
      // @ts-ignore
      (modalRoutes?.params?.screen === EModalRoutes.ReceiveModal &&
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        modalRoutes?.params?.params?.screen ===
          EModalReceiveRoutes.ReceiveSelectToken)
    ) {
      setShouldAlwaysFetch(true);
    } else {
      setShouldAlwaysFetch(false);
    }
  });

  const {
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshTokenList,
    refreshTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshAggregateTokensListMap,
    refreshAggregateTokensMap,
    updateTokenListState,
    updateSearchKey,
  } = useTokenListActions().current;

  const [aggregateTokenListMapAtom] = useAggregateTokensListMapAtom();
  const [tokenListMapAtom] = useTokenListMapAtom();
  const [allTokenListAtomValue] = useAllTokenListAtom();
  const [renderedTokenListCache] = useRenderedTokenListCacheAtom();
  const {
    updateAccountWorth,
    updateAccountOverviewState,
    updateAllNetworksState,
  } = useAccountOverviewActions().current;

  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      if (value === showLpTokensOnly) {
        return;
      }
      latestTokenSelectorFilterModeRef.current =
        buildTokenSelectorFilterMode(value);
      if (value && account?.id && network?.id) {
        setScopedLpTokenListState({
          initialized: false,
          isRefreshing: true,
        });
        setScopedLpTokenList({
          tokens: [],
          keys: '',
        });
        setScopedLpTokenListMap({});
      } else {
        setScopedLpTokenListState({
          initialized: true,
          isRefreshing: false,
        });
        refreshWalletTokenListRef.current?.({ forceWalletTokenMode: true });
      }
      setTokenSelectorFilter((prev) => ({
        ...prev,
        homeShowLpTokensOnly: value,
      }));
    },
    [account?.id, network?.id, setTokenSelectorFilter, showLpTokensOnly],
  );

  const { result: homeDefaultTokenMap } = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceToken.getHomeDefaultTokenMap();
    return r;
  }, []);

  const { run } = usePromiseResult(
    async () => {
      let accountId = account?.id ?? '';
      let tokenListRefreshEventStarted = false;
      const endTokenListRefreshEvent = () => {
        if (!tokenListRefreshEventStarted) {
          return;
        }
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: false,
          type: EHomeTab.TOKENS,
          accountId,
          networkId: network?.id ?? '',
        });
        tokenListRefreshEventStarted = false;
      };
      const requestTokenSelectorFilterMode =
        latestTokenSelectorFilterModeRef.current;
      try {
        if (requestTokenSelectorFilterMode !== 'wallet-token') {
          return;
        }
        if (!network) return;

        if (!mergeDeriveAddressData) {
          if (!account) return;
        } else {
          accountId = indexedAccount?.id ?? '';
        }

        if (network.isAllNetworks) return;

        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.TOKENS,
          accountId,
          networkId: network.id,
        });
        tokenListRefreshEventStarted = true;

        await backgroundApiProxy.serviceToken.abortFetchAccountTokens();

        let r: IFetchAccountTokensResp = getEmptyTokenData();

        if (mergeDeriveAddressData) {
          const { networkAccounts } =
            await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                networkId: network.id,
                indexedAccountId: indexedAccount?.id ?? '',
                excludeEmptyAccount: true,
              },
            );

          const resp = await Promise.all(
            networkAccounts.map((networkAccount) =>
              backgroundApiProxy.serviceToken.fetchAccountTokens({
                accountId: networkAccount.account?.id ?? '',
                mergeTokens: true,
                networkId: network.id,
                flag: 'home-token-list',
                saveToLocal: true,
                indexedAccountId: indexedAccount?.id,
                ...walletTokenFilterParams,
              }),
            ),
          );

          const {
            tokenList,
            smallBalanceTokenList,
            riskyTokenList,
            tokenListMap,
            smallBalanceTokenListMap,
            riskyTokenListMap,
            allTokenList,
            allTokenListMap,
          } = getMergedDeriveTokenData({
            data: resp,
            mergeDeriveAssetsEnabled: true,
          });

          r.tokens = {
            data: tokenList.tokens,
            keys: tokenList.keys,
            fiatValue: tokenList.fiatValue,
            map: tokenListMap,
          };
          r.smallBalanceTokens = {
            data: smallBalanceTokenList.smallBalanceTokens,
            keys: smallBalanceTokenList.keys,
            fiatValue: smallBalanceTokenList.fiatValue,
            map: smallBalanceTokenListMap,
          };
          r.riskTokens = {
            data: riskyTokenList.riskyTokens,
            keys: riskyTokenList.keys,
            fiatValue: riskyTokenList.fiatValue,
            map: riskyTokenListMap,
          };
          r.allTokens = {
            data: allTokenList.tokens,
            keys: allTokenList.keys,
            fiatValue: allTokenList.fiatValue,
            map: allTokenListMap,
          };

          const accountWorth: Record<string, string> = {};

          resp.forEach((item) => {
            if (item.accountId && item.networkId) {
              let accountWorthValue = new BigNumber(0);
              accountWorthValue = accountWorthValue
                .plus(item.tokens.fiatValue ?? '0')
                .plus(item.smallBalanceTokens.fiatValue ?? '0');

              accountWorth[
                accountUtils.buildAccountValueKey({
                  accountId: item.accountId,
                  networkId: item.networkId,
                })
              ] = accountWorthValue.toFixed();
            }
          });

          if (
            latestTokenSelectorFilterModeRef.current !==
            requestTokenSelectorFilterMode
          ) {
            return;
          }

          if (syncTokenFilterToOverview) {
            updateAccountOverviewState({
              isRefreshing: false,
              initialized: true,
            });

            updateAccountWorth({
              accountId,
              initialized: true,
              worth: accountWorth,
              createAtNetworkWorth: '0',
              merge: false,
            });
          }
        } else {
          r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId,
            mergeTokens: true,
            networkId: network.id,
            flag: 'home-token-list',
            saveToLocal: true,
            indexedAccountId: indexedAccount?.id,
            ...walletTokenFilterParams,
          });

          let accountWorth = new BigNumber(0);
          accountWorth = accountWorth
            .plus(r.tokens.fiatValue ?? '0')
            .plus(r.smallBalanceTokens.fiatValue ?? '0');

          if (
            latestTokenSelectorFilterModeRef.current !==
            requestTokenSelectorFilterMode
          ) {
            return;
          }

          if (syncTokenFilterToOverview) {
            updateAccountOverviewState({
              isRefreshing: false,
              initialized: true,
            });

            updateAccountWorth({
              accountId,
              initialized: true,
              worth: {
                [accountUtils.buildAccountValueKey({
                  accountId,
                  networkId: network.id,
                })]: accountWorth.toFixed(),
              },
              createAtNetworkWorth: accountWorth.toFixed(),
              merge: false,
            });
          }
        }

        refreshTokenList({ keys: r.tokens.keys, tokens: r.tokens.data });
        // can search all tokens in token list
        refreshTokenListMap({
          tokens: {
            ...r.tokens.map,
            ...r.smallBalanceTokens.map,
            ...r.riskTokens.map,
          },
        });
        refreshRiskyTokenList({
          keys: r.riskTokens.keys,
          riskyTokens: r.riskTokens.data,
        });
        refreshRiskyTokenListMap({
          tokens: r.riskTokens.map,
        });
        refreshSmallBalanceTokenList({
          keys: r.smallBalanceTokens.keys,
          smallBalanceTokens: r.smallBalanceTokens.data,
        });
        refreshSmallBalanceTokenListMap({
          tokens: r.smallBalanceTokens.map,
        });
        refreshSmallBalanceTokensFiatValue({
          value: r.smallBalanceTokens.fiatValue ?? '0',
        });

        if (r.allTokens) {
          refreshAllTokenList({
            keys: r.allTokens?.keys,
            tokens: r.allTokens?.data,
            accountId: account?.id,
            networkId: network?.id,
          });
          refreshAllTokenListMap({
            tokens: r.allTokens.map,
          });
          const mergedTokens = r.allTokens.data;
          if (mergedTokens && mergedTokens.length) {
            void backgroundApiProxy.serviceToken.updateLocalTokens({
              networkId: network.id,
              tokens: mergedTokens,
            });
          }

          perfTokenListView.markEnd(
            'tokenListRefreshing_tokenListContainerRefreshList',
          );
          updateTokenListState({
            initialized: true,
            isRefreshing: false,
          });

          endTokenListRefreshEvent();
        }
      } catch (e) {
        endTokenListRefreshEvent();
        if (e instanceof CanceledError) {
          console.log('fetchAccountTokens canceled');
        } else {
          throw e;
        }
      } finally {
        endTokenListRefreshEvent();
        setIsHeaderRefreshing(false);
      }
    },
    [
      account,
      network,
      mergeDeriveAddressData,
      updateAccountOverviewState,
      updateAccountWorth,
      refreshTokenList,
      refreshTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshSmallBalanceTokensFiatValue,
      indexedAccount?.id,
      refreshAllTokenList,
      refreshAllTokenListMap,
      updateTokenListState,
      setIsHeaderRefreshing,
      syncTokenFilterToOverview,
      walletTokenFilterParams,
    ],
    {
      overrideIsFocused: (isPageFocused) =>
        (isPageFocused && isFocused) || shouldAlwaysFetch,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
      revalidateOnFocus: true,
    },
  );

  const { run: runLpTokenList } = usePromiseResult(
    async () => {
      if (!showLpTokensOnly || !account?.id || !network?.id) {
        return;
      }

      const requestContext: IActiveAccountTokenListRequestContext = {
        accountId: account.id,
        indexedAccountId: indexedAccount?.id ?? '',
        networkId: network.id,
        mergeDeriveAddressData: !!mergeDeriveAddressData,
        tokenSelectorFilterMode,
      };

      const isLatestRequest = () =>
        isSameActiveAccountTokenListRequestContext(
          latestActiveAccountTokenListRequestContextRef.current,
          requestContext,
        );

      if (
        requestContext.tokenSelectorFilterMode !== 'lp-dapp-token' ||
        !isLatestRequest()
      ) {
        return;
      }

      // Keep the rendered DeFi-token list during focus revalidation. Owner or
      // mode changes already clear the scoped list above; clearing it here makes
      // Tabs remeasure the page height when returning from token details.
      setScopedLpTokenListState((prev) => ({
        ...prev,
        isRefreshing: true,
      }));

      try {
        const responses = await fetchFilteredTokenSelectorTokens({
          accountId: account.id,
          networkId: network.id,
          indexedAccountId: indexedAccount?.id,
          isAllNetworks: network.isAllNetworks,
          mergeDeriveAddressData: !!mergeDeriveAddressData,
          tokenSelectorFilterParams,
        });

        if (!isLatestRequest()) {
          return;
        }

        const { tokenList, tokenListMap } =
          buildScopedActiveTokenListFromResponses({
            responses,
            keySuffix: 'lp-dapp-token',
          });

        setScopedLpTokenList(tokenList);
        setScopedLpTokenListMap(tokenListMap);
      } catch (e) {
        console.error(e);
      } finally {
        if (isLatestRequest()) {
          setScopedLpTokenListState({
            initialized: true,
            isRefreshing: false,
          });
        }
        setIsHeaderRefreshing(false);
      }
    },
    [
      account?.id,
      indexedAccount?.id,
      mergeDeriveAddressData,
      network?.id,
      network?.isAllNetworks,
      showLpTokensOnly,
      tokenSelectorFilterMode,
      tokenSelectorFilterParams,
      setIsHeaderRefreshing,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      revalidateOnFocus: true,
    },
  );

  useLayoutEffect(() => {
    if (!showLpTokensOnly || !account?.id || !network?.id) {
      return;
    }

    setScopedLpTokenListState({
      initialized: false,
      isRefreshing: true,
    });
    setScopedLpTokenList({
      tokens: [],
      keys: '',
    });
    setScopedLpTokenListMap({});
    // Persisted DeFi-token mode can mount before tab focus settles; make the
    // initial clear and initial fetch atomic so loading always resolves.
    void runLpTokenList({ alwaysSetState: true });
  }, [
    account?.id,
    indexedAccount?.id,
    mergeDeriveAddressData,
    network?.id,
    runLpTokenList,
    showLpTokensOnly,
  ]);

  const { result: allAggregateTokenInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceToken.getAllAggregateTokenInfo(),
    [],
  );

  const { allAggregateTokenMap } = allAggregateTokenInfo ?? {};

  const isAllNetworkManualRefresh = useRef(false);

  const updateAllNetworkData = useThrottledCallback(() => {
    refreshTokenList({
      keys: tokenListRef.current.keys,
      tokens: tokenListRef.current.tokens,
      merge: true,
      map: tokenListRef.current.map,
      mergeDerive: true,
      split: true,
    });

    refreshRiskyTokenList({
      keys: riskyTokenListRef.current.keys,
      riskyTokens: riskyTokenListRef.current.tokens,
      merge: true,
      map: riskyTokenListRef.current.map,
      mergeDerive: true,
    });

    tokenListRef.current.tokens = [];
    tokenListRef.current.keys = '';
    tokenListRef.current.map = {};

    riskyTokenListRef.current.tokens = [];
    riskyTokenListRef.current.keys = '';
    riskyTokenListRef.current.map = {};
  }, 1000);

  const handleAllNetworkRequests = useCallback(
    async ({
      accountId,
      networkId,
      dbAccount,
      allNetworkDataInit,
      isSingleRequest,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
      allNetworkDataInit?: boolean;
      isSingleRequest?: boolean;
    }) => {
      if (latestTokenSelectorFilterModeRef.current !== 'wallet-token') {
        isAllNetworkManualRefresh.current = false;
        return undefined;
      }

      const response = await backgroundApiProxy.serviceToken.fetchAccountTokens(
        {
          dbAccount,
          networkId,
          accountId,
          indexedAccountId: indexedAccount?.id,
          flag: 'home-token-list',
          isAllNetworks: true,
          isManualRefresh: isAllNetworkManualRefresh.current,
          allNetworksAccountId: account?.id,
          allNetworksNetworkId: network?.id,
          saveToLocal: true,
          ...walletTokenFilterParams,
          customTokensRawData: customTokensRawData.current,
          blockedTokensRawData:
            riskTokenManagementRawData.current.blockedTokens,
          unblockedTokensRawData:
            riskTokenManagementRawData.current.unblockedTokens,
        },
      );
      const r: IAllNetworkTokenListResp = {
        ...response,
        tokenSelectorFilterMode,
        syncTokenFilterToOverview,
      };

      if (
        latestTokenSelectorFilterModeRef.current !== tokenSelectorFilterMode
      ) {
        isAllNetworkManualRefresh.current = false;
        return r;
      }

      const aggregateTokenConfigMapRawData =
        aggregateTokenRawData.current?.aggregateTokenConfigMap;

      let aggregateTokenListMap: Record<
        string,
        {
          commonToken: IAccountToken;
          tokens: IAccountToken[];
        }
      > = {};
      let aggregateTokenMap: Record<string, ITokenFiat> = {};

      const [tokenNetwork, tokenVaultSettings] = await Promise.all([
        backgroundApiProxy.serviceNetwork.getNetwork({
          networkId,
        }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        }),
      ]);

      if (
        latestTokenSelectorFilterModeRef.current !== tokenSelectorFilterMode
      ) {
        isAllNetworkManualRefresh.current = false;
        return r;
      }

      if (aggregateTokenConfigMapRawData) {
        r.tokens.data = r.tokens.data
          .map((token) => {
            const data = buildAggregateTokenListData({
              networkId,
              accountId,
              token,
              tokenMap: r.tokens.map,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData,
              networkName: tokenNetwork?.name ?? '',
            });

            if (data.isAggregateToken) {
              aggregateTokenListMap = data.aggregateTokenListMap;
              aggregateTokenMap = data.aggregateTokenMap;
              return null;
            }

            return token;
          })
          .filter(Boolean);

        r.smallBalanceTokens.data = r.smallBalanceTokens.data
          .map((token) => {
            const data = buildAggregateTokenListData({
              networkId,
              accountId,
              token,
              tokenMap: r.smallBalanceTokens.map,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData,
              networkName: tokenNetwork?.name ?? '',
            });

            if (data.isAggregateToken) {
              aggregateTokenListMap = data.aggregateTokenListMap;
              aggregateTokenMap = data.aggregateTokenMap;
              return null;
            }

            return token;
          })
          .filter(Boolean);

        const aggregateTokenList = Object.values(aggregateTokenListMap).map(
          (item) => item.commonToken,
        );

        r.tokens.data = [...r.tokens.data, ...aggregateTokenList];
        r.aggregateTokenListMap = aggregateTokenListMap;
        r.aggregateTokenMap = aggregateTokenMap;
      }

      const { tokens, riskTokens, smallBalanceTokens } = r;

      const { allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      });

      if (allTokens) {
        allTokens.data = allTokens.data.map((token) => ({
          ...token,
          accountId,
          networkId,
          networkName: tokenNetwork?.name,
          mergeAssets: tokenVaultSettings.mergeDeriveAssetsEnabled,
        }));
      }
      r.allTokens = allTokens;

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
        let accountWorth = new BigNumber(0);
        let createAtNetworkWorth = new BigNumber(0);

        accountWorth = accountWorth
          .plus(r.tokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0');

        perfTokenListView.markEnd('tokenListRefreshing_allNetworkRequests');
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        if (syncTokenFilterToOverview) {
          updateAccountOverviewState({
            isRefreshing: false,
            initialized: true,
          });

          if (
            account?.id &&
            (!accountUtils.isOthersAccount({ accountId: account.id }) ||
              (accountUtils.isOthersAccount({ accountId: account.id }) &&
                account?.createAtNetwork &&
                account.createAtNetwork === networkId))
          ) {
            createAtNetworkWorth = accountWorth;
          }

          updateAccountWorth({
            accountId: mergeDeriveAddressData
              ? (indexedAccount?.id ?? '')
              : (account?.id ?? ''),
            initialized: true,
            worth: {
              [accountUtils.buildAccountValueKey({
                accountId,
                networkId,
              })]: accountWorth.toFixed(),
            },
            createAtNetworkWorth: createAtNetworkWorth.toFixed(),
            merge: true,
          });
        }

        const mergeDeriveAssetsEnabled = !!(
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          })
        ).mergeDeriveAssetsEnabled;

        tokenListRef.current.tokens = tokenListRef.current.tokens.concat([
          ...r.tokens.data,
          ...r.smallBalanceTokens.data,
        ]);

        tokenListRef.current.keys = `${tokenListRef.current.keys}_${r.tokens.keys}`;

        const mergedMap = {
          ...r.tokens.map,
          ...r.smallBalanceTokens.map,
        };

        tokenListRef.current.map = {
          ...mergedMap,
          ...tokenListRef.current.map,
        };

        riskyTokenListRef.current.tokens =
          riskyTokenListRef.current.tokens.concat([...r.riskTokens.data]);

        riskyTokenListRef.current.keys = `${riskyTokenListRef.current.keys}_${r.riskTokens.keys}`;

        riskyTokenListRef.current.map = {
          ...r.riskTokens.map,
          ...riskyTokenListRef.current.map,
        };

        if (r.aggregateTokenListMap) {
          refreshAggregateTokensListMap({
            tokens: r.aggregateTokenListMap,
            merge: true,
          });
        }

        if (r.aggregateTokenMap) {
          refreshAggregateTokensMap({
            tokens: nestAggregateTokensMap({
              aggregateTokenMap: r.aggregateTokenMap,
              networkId,
            }),
            merge: isSingleRequest,
          });
        }

        refreshTokenListMap({
          tokens: mergedMap,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        refreshSmallBalanceTokenListMap({
          tokens: mergedMap,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        refreshRiskyTokenListMap({
          tokens: r.riskTokens.map,
          merge: true,
          mergeDerive: mergeDeriveAssetsEnabled,
        });

        if (r.allTokens) {
          refreshAllTokenListMap({
            tokens: r.allTokens.map,
            merge: true,
            mergeDerive: mergeDeriveAssetsEnabled,
          });
          refreshAllTokenList({
            keys: r.allTokens.keys,
            tokens: r.allTokens.data,
            map: r.allTokens.map,
            merge: true,
            mergeDerive: mergeDeriveAssetsEnabled,
            accountId: account?.id,
            networkId: network?.id,
          });
        }

        updateAllNetworkData();
      }

      isAllNetworkManualRefresh.current = false;
      return r;
    },
    [
      account?.createAtNetwork,
      account?.id,
      indexedAccount?.id,
      mergeDeriveAddressData,
      network?.id,
      refreshAggregateTokensListMap,
      refreshAggregateTokensMap,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenListMap,
      refreshTokenListMap,
      updateAccountOverviewState,
      updateAccountWorth,
      updateAllNetworkData,
      updateTokenListState,
      tokenSelectorFilterMode,
      syncTokenFilterToOverview,
      walletTokenFilterParams,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    const emptyTokens = getEmptyTokenData();

    refreshSmallBalanceTokensFiatValue({
      value: '0',
    });

    refreshAllTokenList({
      tokens: emptyTokens.allTokens.data,
      keys: emptyTokens.allTokens.keys,
      accountId: account?.id,
      networkId: network?.id,
    });
    refreshAllTokenListMap({
      tokens: emptyTokens.allTokens.map,
    });

    refreshTokenList({
      tokens: emptyTokens.tokens.data,
      keys: emptyTokens.tokens.keys,
    });
    refreshTokenListMap({
      tokens: emptyTokens.tokens.map,
    });

    refreshSmallBalanceTokenList({
      smallBalanceTokens: emptyTokens.smallBalanceTokens.data,
      keys: emptyTokens.smallBalanceTokens.keys,
    });
    refreshSmallBalanceTokenListMap({
      tokens: emptyTokens.smallBalanceTokens.map,
    });

    refreshRiskyTokenList({
      riskyTokens: emptyTokens.riskTokens.data,
      keys: emptyTokens.riskTokens.keys,
    });

    refreshRiskyTokenListMap({
      tokens: emptyTokens.riskTokens.map,
    });
  }, [
    account?.id,
    network?.id,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshTokenList,
    refreshTokenListMap,
  ]);

  const handleAllNetworkRequestsFinished = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.TOKENS,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
    },
    [],
  );

  const handleAllNetworkCacheChecked = useCallback(
    ({
      accountId,
      networkId,
      hasCache,
    }: {
      accountId?: string;
      networkId?: string;
      hasCache: boolean;
    }) => {
      if (latestTokenSelectorFilterModeRef.current !== 'wallet-token') {
        return;
      }
      if (!syncTokenFilterToOverview) {
        return;
      }
      setOverviewTokenCacheState({
        ownerKey: buildOverviewOwnerKey(accountId, networkId),
        hasCache,
      });
    },
    [setOverviewTokenCacheState, syncTokenFilterToOverview],
  );

  const handleAllNetworkRequestsStarted = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      perfTokenListView.markStart('allNetworkRequestsStarted_getRawData');

      // eslint-disable-next-line prefer-const
      let [c, r, l, a] = await Promise.all([
        backgroundApiProxy.simpleDb.customTokens.getRawData(),
        backgroundApiProxy.simpleDb.riskTokenManagement.getRawData(),
        backgroundApiProxy.simpleDb.localTokens.getRawData(),
        backgroundApiProxy.simpleDb.aggregateToken.getRawData(),
      ]);

      perfTokenListView.markEnd('allNetworkRequestsStarted_getRawData');

      if (!a?.aggregateTokenConfigMap) {
        await backgroundApiProxy.serviceSetting.syncWalletConfig();
        a = await backgroundApiProxy.simpleDb.aggregateToken.getRawData();
      }

      customTokensRawData.current = c ?? undefined;
      riskTokenManagementRawData.current = {
        unblockedTokens: r?.unblockedTokens ?? {},
        blockedTokens: r?.blockedTokens ?? {},
      };
      localTokensRawData.current = l ?? undefined;
      aggregateTokenRawData.current = a ?? undefined;

      if (latestTokenSelectorFilterModeRef.current !== 'wallet-token') {
        return;
      }

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.TOKENS,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

      if (syncTokenFilterToOverview) {
        setOverviewTokenCacheState({
          ownerKey: buildOverviewOwnerKey(account?.id, network?.id),
          hasCache: undefined,
        });
      }
    },
    [
      account?.id,
      network?.id,
      setOverviewTokenCacheState,
      syncTokenFilterToOverview,
    ],
  );

  const handleAllNetworkCacheRequests = useCallback(
    async ({
      accountId,
      networkId,
      xpub,
      accountAddress,
    }: {
      accountId: string;
      networkId: string;
      xpub?: string;
      accountAddress: string;
    }) => {
      if (latestTokenSelectorFilterModeRef.current !== 'wallet-token') {
        return null;
      }

      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.allNetwork__handleAllNetworkCacheRequests,
      });

      perf.markStart('getAccountLocalTokens', {
        networkId,
        accountAddress,
        rawDataExist: !!localTokensRawData.current,
      });
      const localTokens =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId,
          networkId,
          accountAddress,
          xpub,
          simpleDbLocalTokensRawData: localTokensRawData.current,
        });
      perf.markEnd('getAccountLocalTokens');

      const { tokenList, smallBalanceTokenList, riskyTokenList } = localTokens;

      perf.done();
      if (
        isEmpty(tokenList) &&
        isEmpty(riskyTokenList) &&
        isEmpty(smallBalanceTokenList) &&
        !localTokens.hasCache
      ) {
        return null;
      }

      return {
        ...localTokens,
        tokenList,
        smallBalanceTokenList,
        riskyTokenList,
        accountId,
        networkId,
      };
    },
    [],
  );

  const handleAllNetworkCacheData = useCallback(
    async ({
      data,
      accountId,
      networkId,
    }: {
      data: {
        tokenList: IAccountToken[];
        smallBalanceTokenList: IAccountToken[];
        riskyTokenList: IAccountToken[];
        tokenListMap: {
          [key: string]: ITokenFiat;
        };
        tokenListValue: string;
        networkId: string;
        accountId: string;
        hasCache: boolean;
      }[];
      accountId: string;
      networkId: string;
    }) => {
      if (
        latestTokenSelectorFilterModeRef.current !== tokenSelectorFilterMode
      ) {
        return;
      }

      perfTokenListView.markStart('handleAllNetworkCacheData');

      aggregateTokenRawData.current =
        (await backgroundApiProxy.simpleDb.aggregateToken.getRawData()) ??
        undefined;

      const key = buildLocalAggregateTokenMapKey({
        networkId,
        accountId,
      });

      const localAggregateTokenMap =
        aggregateTokenRawData.current?.aggregateTokenMapV2?.[key] ?? {};
      const localAggregateTokenListMap =
        aggregateTokenRawData.current?.aggregateTokenListMap?.[key] ?? {};
      const aggregateTokenConfigMap =
        aggregateTokenRawData.current?.aggregateTokenConfigMap ?? {};

      const flattenLocalAggregateTokenMap = flattenAggregateTokensMap(
        localAggregateTokenMap,
      );

      let tokenList: IAccountToken[] = [];
      const riskyTokenList: IAccountToken[] = [];
      let tokenListMap: {
        [key: string]: ITokenFiat;
      } = {};
      let tokenListValue: Record<string, string> = {};
      let aggregateTokenListMap: Record<
        string,
        {
          commonToken: IAccountToken;
          tokens: IAccountToken[];
        }
      > = {};
      let aggregateTokenMap: {
        [key: string]: ITokenFiat;
      } = {};
      const hasAnyCache = data.some((item) => item.hasCache);
      data.forEach((item) => {
        tokenList.push(...item.tokenList, ...item.smallBalanceTokenList);
        riskyTokenList.push(...item.riskyTokenList);
        tokenListMap = {
          ...tokenListMap,
          ...item.tokenListMap,
        };
        tokenListValue = {
          ...tokenListValue,
          [accountUtils.buildAccountValueKey({
            accountId: item.accountId,
            networkId: item.networkId,
          })]: item.tokenListValue,
        };
      });

      if (aggregateTokenConfigMap) {
        tokenList = tokenList
          .map((token) => {
            const aggregateTokenData = buildAggregateTokenListData({
              networkId: token.networkId ?? '',
              accountId: token.accountId ?? '',
              token,
              tokenMap: tokenListMap,
              aggregateTokenListMap,
              aggregateTokenMap,
              aggregateTokenConfigMapRawData: aggregateTokenConfigMap,
              networkName: '',
            });

            if (aggregateTokenData.isAggregateToken) {
              aggregateTokenListMap = aggregateTokenData.aggregateTokenListMap;
              aggregateTokenMap = aggregateTokenData.aggregateTokenMap;
              return null;
            }

            return token;
          })
          .filter(Boolean);

        const aggregateTokenList = Object.values(aggregateTokenListMap).map(
          (item) => item.commonToken,
        );

        tokenList = [...tokenList, ...aggregateTokenList];
      }

      refreshAggregateTokensMap({
        tokens: localAggregateTokenMap,
      });

      refreshAggregateTokensListMap({
        tokens: localAggregateTokenListMap,
      });

      refreshTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshSmallBalanceTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshRiskyTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshAllTokenListMap({
        tokens: tokenListMap,
        merge: true,
        mergeDerive: true,
      });

      refreshTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        tokens: tokenList,
        merge: true,
        map: {
          ...tokenListMap,
          ...flattenLocalAggregateTokenMap,
        },
        mergeDerive: true,
        split: true,
      });

      refreshRiskyTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        riskyTokens: riskyTokenList,
        merge: true,
        map: {
          ...tokenListMap,
          ...flattenLocalAggregateTokenMap,
        },
        mergeDerive: true,
      });

      refreshAllTokenList({
        keys: `${accountId}_${networkId}_local_all`,
        tokens: [...tokenList, ...riskyTokenList],
        map: {
          ...tokenListMap,
          ...flattenLocalAggregateTokenMap,
        },
        merge: true,
        mergeDerive: true,
        accountId: account?.id,
        networkId: network?.id,
      });

      if (syncTokenFilterToOverview) {
        setOverviewTokenCacheState({
          ownerKey: buildOverviewOwnerKey(accountId, networkId),
          hasCache: hasAnyCache,
        });
      }

      if (hasAnyCache) {
        if (syncTokenFilterToOverview) {
          updateAccountWorth({
            accountId: mergeDeriveAddressData
              ? (indexedAccount?.id ?? '')
              : (account?.id ?? ''),
            initialized: true,
            worth: tokenListValue,
            createAtNetworkWorth:
              tokenListValue[
                accountUtils.buildAccountValueKey({
                  accountId: account?.id ?? '',
                  networkId: account?.createAtNetwork ?? '',
                })
              ],
            updateAll: true,
          });
          updateAccountOverviewState({
            isRefreshing: false,
            initialized: true,
          });
        }
        perfTokenListView.markEnd('tokenListRefreshing_allNetworkCacheData');
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        perfTokenListView.markEnd('handleAllNetworkCacheData');
      }
    },
    [
      account?.createAtNetwork,
      account?.id,
      indexedAccount?.id,
      mergeDeriveAddressData,
      network?.id,
      refreshAggregateTokensListMap,
      refreshAggregateTokensMap,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshSmallBalanceTokenListMap,
      refreshTokenList,
      refreshTokenListMap,
      setOverviewTokenCacheState,
      syncTokenFilterToOverview,
      tokenSelectorFilterMode,
      updateAccountOverviewState,
      updateAccountWorth,
      updateTokenListState,
    ],
  );

  const handleAllNetworkAccountsData = useCallback(
    ({
      accounts,
      allAccounts,
    }: {
      accounts: IAllNetworkAccountInfo[];
      allAccounts: IAllNetworkAccountInfo[];
    }) => {
      updateAllNetworksState({
        visibleCount: uniqBy(allAccounts, 'networkId').length,
      });
      setAllNetworkAccounts(accounts);
    },
    [updateAllNetworksState],
  );

  const {
    run: runAllNetworksRequests,
    result: allNetworksResult,
    isEmptyAccount,
  } = useAllNetworkRequests<IAllNetworkTokenListResp>({
    accountId: account?.id,
    networkId: network?.id,
    walletId: wallet?.id,
    isAllNetworks: network?.isAllNetworks,
    allNetworkRequests: handleAllNetworkRequests,
    allNetworkCacheRequests: handleAllNetworkCacheRequests,
    allNetworkCacheData: handleAllNetworkCacheData,
    allNetworkAccountsData: handleAllNetworkAccountsData,
    clearAllNetworkData: handleClearAllNetworkData,
    onStarted: handleAllNetworkRequestsStarted,
    onFinished: handleAllNetworkRequestsFinished,
    onCacheChecked: handleAllNetworkCacheChecked,
    interval: 200,
    shouldAlwaysFetch,
    disabled: showLpTokensOnly,
  });

  const updateAllNetworksTokenList = useCallback(async () => {
    if (tokenSelectorFilterMode !== 'wallet-token') {
      return;
    }

    const tokenList: {
      tokens: IAccountToken[];
      keys: string;
    } = {
      tokens: [],
      keys: '',
    };

    const smallBalanceTokenList: {
      smallBalanceTokens: IAccountToken[];
      keys: string;
    } = {
      smallBalanceTokens: [],
      keys: '',
    };

    const riskyTokenList: {
      riskyTokens: IAccountToken[];
      keys: string;
    } = {
      riskyTokens: [],
      keys: '',
    };

    let tokenListMap: {
      [key: string]: ITokenFiat;
    } = {};

    let smallBalanceTokenListMap: {
      [key: string]: ITokenFiat;
    } = {};

    let riskyTokenListMap: {
      [key: string]: ITokenFiat;
    } = {};
    const accountsWorth: Record<string, string> = {};
    let createAtNetworkWorth = new BigNumber(0);
    let smallBalanceTokensFiatValue = new BigNumber(0);

    let aggregateTokenListMap: {
      [key: string]: {
        tokens: IAccountToken[];
      };
    } = {};

    let aggregateTokenMap: Record<string, Record<string, ITokenFiat>> = {};

    if (allNetworksResult?.length) {
      const resultTokenSelectorFilterMode =
        allNetworksResult[0].tokenSelectorFilterMode;
      const hasMixedTokenSelectorFilterResult = allNetworksResult.some(
        (result) =>
          result.tokenSelectorFilterMode !== resultTokenSelectorFilterMode,
      );
      if (
        resultTokenSelectorFilterMode !== tokenSelectorFilterMode ||
        hasMixedTokenSelectorFilterResult
      ) {
        return;
      }
      const shouldSyncTokenFilterToOverview =
        allNetworksResult[0].syncTokenFilterToOverview;

      for (const r of allNetworksResult) {
        let mergeDeriveAssetsEnabled;

        try {
          if (r.networkId) {
            mergeDeriveAssetsEnabled = (
              await backgroundApiProxy.serviceNetwork.getVaultSettings({
                networkId: r.networkId ?? '',
              })
            ).mergeDeriveAssetsEnabled;
          }
        } catch (_e) {
          mergeDeriveAssetsEnabled = false;
        }

        if (r.aggregateTokenListMap) {
          aggregateTokenListMap = mergeAggregateTokenListMap({
            sourceMap: r.aggregateTokenListMap,
            targetMap: aggregateTokenListMap,
          });
        }

        if (r.aggregateTokenMap) {
          const nestedAggregateTokenMap = nestAggregateTokensMap({
            aggregateTokenMap: r.aggregateTokenMap,
            networkId: r.networkId ?? '',
          });
          aggregateTokenMap = mergeNestedAggregateTokenMap({
            sourceMap: nestedAggregateTokenMap,
            targetMap: aggregateTokenMap,
          });
        }

        tokenList.tokens = mergeDeriveTokenList({
          sourceTokens: r.tokens.data,
          targetTokens: tokenList.tokens,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        tokenList.keys = `${tokenList.keys}_${r.tokens.keys}`;
        tokenListMap = mergeDeriveTokenListMap({
          sourceMap: r.tokens.map,
          targetMap: tokenListMap,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        smallBalanceTokenList.smallBalanceTokens = mergeDeriveTokenList({
          sourceTokens: r.smallBalanceTokens.data,
          targetTokens: smallBalanceTokenList.smallBalanceTokens,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        smallBalanceTokenList.keys = `${smallBalanceTokenList.keys}_${r.smallBalanceTokens.keys}`;

        smallBalanceTokenListMap = mergeDeriveTokenListMap({
          sourceMap: r.smallBalanceTokens.map,
          targetMap: smallBalanceTokenListMap,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        riskyTokenList.riskyTokens = mergeDeriveTokenList({
          sourceTokens: r.riskTokens.data,
          targetTokens: riskyTokenList.riskyTokens,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        riskyTokenList.riskyTokens = riskyTokenList.riskyTokens.concat(
          r.riskTokens.data,
        );
        riskyTokenList.keys = `${riskyTokenList.keys}_${r.riskTokens.keys}`;

        riskyTokenListMap = mergeDeriveTokenListMap({
          sourceMap: r.riskTokens.map,
          targetMap: riskyTokenListMap,
          mergeDeriveAssets: mergeDeriveAssetsEnabled,
        });

        const accountWorth = new BigNumber(r.tokens.fiatValue ?? '0').plus(
          r.smallBalanceTokens.fiatValue ?? '0',
        );

        accountsWorth[
          accountUtils.buildAccountValueKey({
            accountId: r.accountId ?? '',
            networkId: r.networkId ?? '',
          })
        ] = accountWorth.toFixed();

        if (
          account?.id &&
          (!accountUtils.isOthersAccount({ accountId: account.id }) ||
            (accountUtils.isOthersAccount({ accountId: account.id }) &&
              account?.createAtNetwork &&
              account.createAtNetwork === r.networkId))
        ) {
          createAtNetworkWorth = createAtNetworkWorth
            .plus(r.tokens.fiatValue ?? '0')
            .plus(r.smallBalanceTokens.fiatValue ?? '0');
        }
      }

      if (
        latestTokenSelectorFilterModeRef.current !==
        resultTokenSelectorFilterMode
      ) {
        return;
      }

      if (shouldSyncTokenFilterToOverview) {
        void backgroundApiProxy.serviceToken.updateLocalAggregateTokenMap({
          networkId: network?.id ?? '',
          accountId: account?.id ?? '',
          aggregateTokenMap,
        });

        void backgroundApiProxy.serviceToken.updateLocalAggregateTokenListMap({
          networkId: network?.id ?? '',
          accountId: account?.id ?? '',
          aggregateTokenListMap,
        });
      }

      tokenList.tokens = uniqBy(tokenList.tokens, (item) => item.$key);
      smallBalanceTokenList.smallBalanceTokens = uniqBy(
        smallBalanceTokenList.smallBalanceTokens,
        (item) => item.$key,
      );
      riskyTokenList.riskyTokens = uniqBy(
        riskyTokenList.riskyTokens,
        (item) => item.$key,
      );

      const mergeTokenListMap = {
        ...tokenListMap,
        ...smallBalanceTokenListMap,
      };

      const flattenAggregateTokenMap =
        flattenAggregateTokensMap(aggregateTokenMap);

      let mergedTokens = sortTokensByFiatValue({
        tokens: [
          ...tokenList.tokens,
          ...smallBalanceTokenList.smallBalanceTokens,
        ],
        map: {
          ...mergeTokenListMap,
          ...flattenAggregateTokenMap,
        },
      });

      const index = mergedTokens.findIndex((token) =>
        new BigNumber(mergeTokenListMap[token.$key]?.fiatValue ?? 0).isZero(),
      );

      if (index > -1) {
        const tokensWithBalance = mergedTokens.slice(0, index);
        let tokensWithZeroBalance = mergedTokens.slice(index);

        tokensWithZeroBalance = sortTokensByOrder({
          tokens: tokensWithZeroBalance,
        });

        mergedTokens = [...tokensWithBalance, ...tokensWithZeroBalance];
      }

      tokenList.tokens = mergedTokens.slice(0, TOKEN_LIST_HIGH_VALUE_MAX);

      smallBalanceTokenList.smallBalanceTokens = mergedTokens.slice(
        TOKEN_LIST_HIGH_VALUE_MAX,
      );

      smallBalanceTokensFiatValue =
        smallBalanceTokenList.smallBalanceTokens.reduce(
          (acc, token) =>
            acc.plus(mergeTokenListMap[token.$key].fiatValue ?? '0'),
          new BigNumber(0),
        );

      riskyTokenList.riskyTokens = sortTokensByFiatValue({
        tokens: riskyTokenList.riskyTokens,
        map: riskyTokenListMap,
      });

      if (shouldSyncTokenFilterToOverview) {
        updateAccountWorth({
          accountId: mergeDeriveAddressData
            ? (indexedAccount?.id ?? '')
            : (account?.id ?? ''),
          initialized: true,
          updateAll: true,
          worth: accountsWorth,
          createAtNetworkWorth: createAtNetworkWorth.toFixed(),
        });
      }

      refreshAggregateTokensListMap({
        tokens: aggregateTokenListMap,
      });

      refreshAggregateTokensMap({
        tokens: aggregateTokenMap,
      });

      refreshTokenList(tokenList);

      refreshTokenListMap({
        tokens: mergeTokenListMap,
      });

      refreshSmallBalanceTokenList(smallBalanceTokenList);
      refreshSmallBalanceTokenListMap({
        tokens: mergeTokenListMap,
      });
      refreshSmallBalanceTokensFiatValue({
        value: smallBalanceTokensFiatValue.toFixed(),
      });

      refreshRiskyTokenList(riskyTokenList);
      refreshRiskyTokenListMap({
        tokens: riskyTokenListMap,
      });
      refreshAllTokenList({
        keys: `${tokenList.keys}_${smallBalanceTokenList.keys}_${riskyTokenList.keys}`,
        tokens: [...mergedTokens, ...riskyTokenList.riskyTokens],
        accountId: account?.id,
        networkId: network?.id,
      });
      refreshAllTokenListMap({
        tokens: {
          ...mergeTokenListMap,
          ...riskyTokenListMap,
          ...flattenAggregateTokenMap,
        },
      });

      updateTokenListState({
        initialized: true,
        isRefreshing: false,
      });
    }
  }, [
    account?.createAtNetwork,
    account?.id,
    indexedAccount?.id,
    mergeDeriveAddressData,
    allNetworksResult,
    network?.id,
    tokenSelectorFilterMode,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshAggregateTokensListMap,
    refreshAggregateTokensMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshTokenList,
    refreshTokenListMap,
    updateAccountWorth,
    updateTokenListState,
  ]);

  // Eagerly restore the singleton token-list atoms from the per-owner cache
  // when the user switches to a network/account they've previously rendered.
  // Runs synchronously before paint so `tokenListMapAtom` is in sync with
  // the new `tokens` for the same render — without this, the balance and
  // price components would briefly render against the previous owner's map.
  // The async `initTokenListData` below still fetches the latest local cache
  // and overwrites these atoms with fresh data once it returns.
  useLayoutEffect(() => {
    if (showLpTokensOnly) {
      return;
    }

    const currentAccountId = getTokenListOwnerCacheAccountId({
      accountId: account?.id,
      indexedAccountId: indexedAccount?.id,
      mergeDeriveAddressData: !!mergeDeriveAddressData,
    });
    const currentNetworkId = network?.id;
    if (!currentAccountId || !currentNetworkId) return;
    // Every `refreshAllTokenList` writer in this file (the `run` polling
    // fn, `initTokenListData`, `updateAllNetworksTokenList`) stamps
    // `account?.id` into `allTokenList.accountId`. In merge mode
    // `currentAccountId` is `indexedAccountId`, which never equals
    // `account?.id`, so a guard keyed on `currentAccountId` would fail
    // after every normal write and re-fire the hydrate on every poll —
    // repeatedly resetting the small-balance/risky atoms below. Compare
    // and stamp on the writer axis (`account?.id`) to converge.
    const writerAccountId = account?.id;
    if (
      !!writerAccountId &&
      allTokenListAtomValue.accountId === writerAccountId &&
      allTokenListAtomValue.networkId === currentNetworkId
    ) {
      return;
    }
    const ownerKey = `${currentAccountId}__${currentNetworkId}`;
    const cached = (
      renderedTokenListCache as { byOwner?: Record<string, unknown> }
    ).byOwner?.[ownerKey] as
      | {
          tokens: IAccountToken[];
          tokenListMap?: Record<string, ITokenFiat>;
          aggregateTokensMap?: Record<string, Record<string, ITokenFiat>>;
          accountId: string;
          networkId: string;
        }
      | undefined;
    // Legacy entries persisted by an earlier build only carried `tokens`.
    // Hydrating the map atom from `undefined` would set it to undefined and
    // crash readers (e.g. `flattenAggregateTokensMap` doing Object.entries
    // on it) — treat them as invalid and let the async fetch refill normally.
    if (!cached || cached.tokens.length === 0 || !cached.tokenListMap) return;
    const cacheKeys = `${currentAccountId}_${currentNetworkId}_cache`;
    refreshTokenList({ tokens: cached.tokens, keys: cacheKeys });
    refreshTokenListMap({ tokens: cached.tokenListMap });
    refreshAllTokenList({
      keys: cacheKeys,
      tokens: cached.tokens,
      // Stamp `account?.id` to match the other writers; the cache lookup
      // above is owner-aware (indexedAccountId in merge mode) but
      // `allTokenList.accountId` is always written as `account?.id`, so
      // the guard above can detect "already loaded" on later renders.
      accountId: writerAccountId ?? currentAccountId,
      networkId: currentNetworkId,
    });
    refreshAllTokenListMap({ tokens: cached.tokenListMap });
    // Restore the aggregate-token source map so cached aggregate tokens
    // render against their own balances/prices instead of the previous
    // owner's map. Older entries without it leave the atom alone — the
    // async fetch below will refill it.
    if (cached.aggregateTokensMap) {
      refreshAggregateTokensMap({ tokens: cached.aggregateTokensMap });
    }
    // The cache only stores the high-value `tokens` and `tokenListMap`.
    // Reset small-balance and risky atoms here so the footer counts/value
    // and risky list don't briefly mirror the previous owner until the
    // async fetch (initTokenListData) repopulates them.
    refreshSmallBalanceTokenList({ smallBalanceTokens: [], keys: cacheKeys });
    refreshSmallBalanceTokenListMap({ tokens: {} });
    refreshSmallBalanceTokensFiatValue({ value: '0' });
    refreshRiskyTokenList({ riskyTokens: [], keys: cacheKeys });
    refreshRiskyTokenListMap({ tokens: {} });
  }, [
    account?.id,
    indexedAccount?.id,
    mergeDeriveAddressData,
    network?.id,
    allTokenListAtomValue.accountId,
    allTokenListAtomValue.networkId,
    renderedTokenListCache,
    refreshTokenList,
    refreshTokenListMap,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshAggregateTokensMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    handleClearAllNetworkData,
    showLpTokensOnly,
  ]);

  useEffect(() => {
    if (showLpTokensOnly) {
      return;
    }

    // Flips to true on cleanup (next owner change or unmount). Any write
    // back to the singleton token-list atoms after the first `await` must
    // be gated on this — otherwise a slow response from a previous owner
    // can stomp on the freshly hydrated state of the new owner. The
    // `useLayoutEffect` above eagerly hydrates from the per-owner cache,
    // so dropping the late response simply leaves that hydration in place
    // until the new owner's own `initTokenListData` resolves.
    let cancelled = false;
    const initTokenListData = async ({
      accountId,
      networkId,
      accountAddress,
      xpub,
    }: {
      accountId: string;
      networkId: string;
      accountAddress: string;
      xpub: string;
    }) => {
      updateSearchKey('');
      void backgroundApiProxy.serviceToken.updateCurrentAccount({
        networkId,
        accountId,
      });
      if (syncTokenFilterToOverview) {
        setOverviewTokenCacheState({
          ownerKey: buildOverviewOwnerKey(account?.id, networkId),
          hasCache: undefined,
        });
      }

      if (networkId === networkIdsMap.onekeyall) {
        perfTokenListView.markStart('tokenListRefreshing_1');
        updateTokenListState({
          initialized: false,
          isRefreshing: true,
        });
        if (syncTokenFilterToOverview) {
          updateAccountOverviewState({
            initialized: false,
            isRefreshing: true,
          });
        }
        handleClearAllNetworkData();
        return;
      }

      let tokenList: IAccountToken[] = [];
      let smallBalanceTokenList: IAccountToken[] = [];
      let riskyTokenList: IAccountToken[] = [];
      let tokenListMap: Record<string, ITokenFiat> = {};
      let tokenListValue = '0';
      let tokenListWorth: Record<string, string> = {};
      let hasLocalTokenCache = false;

      if (mergeDeriveAddressData) {
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId,
              indexedAccountId: indexedAccount?.id ?? '',
              excludeEmptyAccount: true,
            },
          );

        const resp = await Promise.all(
          networkAccounts.map((networkAccount) =>
            backgroundApiProxy.serviceToken.getAccountLocalTokens({
              accountId: networkAccount.account?.id ?? '',
              networkId,
              accountAddress: networkAccount.account?.address ?? '',
              xpub:
                // @ts-expect-error
                networkAccount.account?.xpubSegwit ||
                // @ts-expect-error
                networkAccount.account?.xpub,
            }),
          ),
        );
        hasLocalTokenCache = resp.some((item) => item.hasCache);

        const params = resp.map((r) => {
          if (r.accountId && r.networkId) {
            tokenListWorth = {
              ...tokenListWorth,
              [accountUtils.buildAccountValueKey({
                accountId: r.accountId,
                networkId: r.networkId,
              })]: r.tokenListValue,
            };
          }
          tokenListValue = new BigNumber(tokenListValue)
            .plus(r.tokenListValue ?? '0')
            .toFixed();
          return {
            tokens: {
              data: r.tokenList,
              keys: '',
              map: r.tokenListMap,
            },
            smallBalanceTokens: {
              data: r.smallBalanceTokenList,
              keys: '',
              map: r.tokenListMap,
            },
            riskTokens: {
              data: r.riskyTokenList,
              keys: '',
              map: r.tokenListMap,
            },
          };
        });

        const tokenListData = getMergedDeriveTokenData({
          data: params,
          mergeDeriveAssetsEnabled: true,
        });

        tokenList = tokenListData.tokenList.tokens;
        smallBalanceTokenList =
          tokenListData.smallBalanceTokenList.smallBalanceTokens;
        riskyTokenList = tokenListData.riskyTokenList.riskyTokens;
        tokenListMap = tokenListData.allTokenListMap;
      } else {
        const localTokens =
          await backgroundApiProxy.serviceToken.getAccountLocalTokens({
            accountId,
            networkId,
            accountAddress,
            xpub,
          });
        hasLocalTokenCache = localTokens.hasCache;

        tokenList = localTokens.tokenList;
        smallBalanceTokenList = localTokens.smallBalanceTokenList;
        riskyTokenList = localTokens.riskyTokenList;
        tokenListMap = localTokens.tokenListMap;
        tokenListValue = localTokens.tokenListValue;
        tokenListWorth = {
          [accountUtils.buildAccountValueKey({
            accountId,
            networkId,
          })]: localTokens.tokenListValue,
        };
      }

      // Owner-change or unmount happened while we were awaiting the local
      // token cache — drop the result so we don't overwrite the new owner's
      // freshly hydrated atoms with this stale response.
      if (cancelled) return;
      if (
        latestTokenSelectorFilterModeRef.current !== tokenSelectorFilterMode
      ) {
        return;
      }

      if (
        isEmpty(tokenList) &&
        isEmpty(smallBalanceTokenList) &&
        isEmpty(riskyTokenList)
      ) {
        if (hasLocalTokenCache) {
          setOverviewTokenCacheState({
            ownerKey: buildOverviewOwnerKey(account?.id, networkId),
            hasCache: true,
          });
          updateAccountWorth({
            accountId: mergeDeriveAddressData
              ? (indexedAccount?.id ?? '')
              : (account?.id ?? ''),
            initialized: true,
            worth: tokenListWorth,
            createAtNetworkWorth: tokenListValue,
            merge: false,
          });
          // Without these refresh calls the token list atoms keep the
          // previous owner's data, leaving allTokenList.accountId/networkId
          // stale and triggering the owner-mismatch skeleton in TokenListView
          // forever for this empty-cache target.
          const emptyKeys = `${accountId}_${networkId}_local_empty`;
          refreshTokenList({ tokens: [], keys: emptyKeys });
          refreshTokenListMap({ tokens: {} });
          refreshSmallBalanceTokenList({
            smallBalanceTokens: [],
            keys: emptyKeys,
          });
          refreshSmallBalanceTokenListMap({ tokens: {} });
          refreshSmallBalanceTokensFiatValue({ value: '0' });
          refreshRiskyTokenList({ riskyTokens: [], keys: emptyKeys });
          refreshRiskyTokenListMap({ tokens: {} });
          // Use the request-time `accountId`/`networkId` (the owner this
          // response belongs to) — not closure-captured React state which
          // can read like "current owner" but is actually frozen at the
          // useEffect run that fired this request.
          refreshAllTokenList({
            keys: emptyKeys,
            tokens: [],
            accountId,
            networkId,
          });
          refreshAllTokenListMap({ tokens: {} });
          handleClearAllNetworkData();
          updateAccountOverviewState({
            isRefreshing: false,
            initialized: true,
          });
          perfTokenListView.markEnd('tokenListRefreshing_initTokenListData');
          updateTokenListState({
            initialized: true,
            isRefreshing: false,
          });
          return;
        }

        setOverviewTokenCacheState({
          ownerKey: buildOverviewOwnerKey(account?.id, networkId),
          hasCache: false,
        });
        perfTokenListView.markStart('tokenListRefreshing_2');
        updateTokenListState({
          initialized: false,
          isRefreshing: true,
        });
        updateAccountOverviewState({
          initialized: false,
          isRefreshing: true,
        });
        if (networkId !== networkIdsMap.onekeyall) {
          handleClearAllNetworkData();
        }
      } else {
        setOverviewTokenCacheState({
          ownerKey: buildOverviewOwnerKey(account?.id, networkId),
          hasCache: true,
        });
        updateAccountWorth({
          accountId: mergeDeriveAddressData
            ? (indexedAccount?.id ?? '')
            : (account?.id ?? ''),
          initialized: true,
          worth: tokenListWorth,
          createAtNetworkWorth: tokenListValue,
          merge: false,
        });
        refreshTokenList({
          tokens: tokenList,
          keys: `${accountId}_${networkId}_local`,
        });
        refreshTokenListMap({
          tokens: tokenListMap,
        });

        refreshSmallBalanceTokenList({
          smallBalanceTokens: smallBalanceTokenList,
          keys: `${accountId}_${networkId}_local`,
        });
        refreshSmallBalanceTokenListMap({
          tokens: tokenListMap,
        });

        refreshRiskyTokenList({
          riskyTokens: riskyTokenList,
          keys: `${accountId}_${networkId}_local`,
        });
        refreshRiskyTokenListMap({
          tokens: tokenListMap,
        });

        // Same rationale as the empty-cache branch above: write the
        // request-time owner IDs so a late response stamps `allTokenList`
        // with the owner it actually belongs to.
        refreshAllTokenList({
          keys: `${accountId}_${networkId}_local`,
          tokens: [...tokenList, ...smallBalanceTokenList, ...riskyTokenList],
          accountId,
          networkId,
        });
        refreshAllTokenListMap({
          tokens: tokenListMap,
        });

        updateAccountOverviewState({
          isRefreshing: false,
          initialized: true,
        });

        perfTokenListView.markEnd('tokenListRefreshing_initTokenListData');
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.TOKENS,
          accountId,
          networkId,
        });
      }
    };

    if ((account?.id || mergeDeriveAddressData) && network?.id && wallet?.id) {
      void initTokenListData({
        accountId: account?.id ?? '',
        networkId: network.id,
        accountAddress: account?.address ?? '',
        // @ts-expect-error
        xpub: account?.xpubSegwit || account?.xpub,
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    account?.address,
    account?.id,
    // @ts-expect-error
    account?.xpub,
    // @ts-expect-error
    account?.xpubSegwit,
    handleClearAllNetworkData,
    indexedAccount?.id,
    mergeDeriveAddressData,
    network?.id,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshTokenList,
    refreshTokenListMap,
    setOverviewTokenCacheState,
    syncTokenFilterToOverview,
    tokenSelectorFilterMode,
    updateAccountOverviewState,
    updateAccountWorth,
    updateSearchKey,
    updateTokenListState,
    wallet?.id,
    showLpTokensOnly,
  ]);

  useEffect(() => {
    void updateAllNetworksTokenList();
  }, [updateAllNetworksTokenList]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      if (showLpTokensOnly) {
        void runLpTokenList({ alwaysSetState: true });
        return;
      }
      void run();
    }
  }, [isHeaderRefreshing, run, runLpTokenList, showLpTokensOnly]);

  const handleOnPressToken = useCallback(
    (token: IAccountToken) => {
      if (!network || !wallet || !deriveInfo || !deriveType) return;

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.TokenDetails,
        params: {
          accountId: token.accountId ?? account?.id ?? '',
          networkId: token.networkId ?? network.id,
          accountAddress: account?.address ?? '',
          walletId: wallet.id,
          isAllNetworks: network.isAllNetworks,
          indexedAccountId: indexedAccount?.id ?? '',
          tokenInfo: token,
          aggregateTokens: aggregateTokenListMapAtom[token.$key]?.tokens ?? [],
          tokenMap: tokenListMapAtom,
        },
      });
    },
    [
      account?.address,
      account?.id,
      aggregateTokenListMapAtom,
      deriveInfo,
      deriveType,
      indexedAccount?.id,
      navigation,
      network,
      tokenListMapAtom,
      wallet,
    ],
  );

  const handleRefreshAllNetworkData = useCallback(() => {
    if (showLpTokensOnly) {
      void runLpTokenList({ alwaysSetState: true });
      return;
    }

    isAllNetworkManualRefresh.current = true;
    void runAllNetworksRequests({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
  }, [runAllNetworksRequests, runLpTokenList, showLpTokensOnly]);

  refreshWalletTokenListRef.current = (options) => {
    if (network?.isAllNetworks) {
      if (options?.forceWalletTokenMode) {
        isAllNetworkManualRefresh.current = true;
        void runAllNetworksRequests({
          alwaysSetState: true,
          skipAccountsCache: true,
        });
        return;
      }
      handleRefreshAllNetworkData();
      return;
    }
    void run({ alwaysSetState: true });
  };

  const lastVisibilityRefreshAtRef = useRef(0);
  const handleRefreshOnVisibilityActive = useCallback(() => {
    const now = Date.now();
    if (now - lastVisibilityRefreshAtRef.current < POLLING_INTERVAL_FOR_TOKEN) {
      return;
    }
    lastVisibilityRefreshAtRef.current = now;

    if (showLpTokensOnly) {
      void runLpTokenList({ alwaysSetState: true });
      return;
    }

    if (network?.isAllNetworks) {
      handleRefreshAllNetworkData();
      return;
    }
    void run({ alwaysSetState: true });
  }, [
    handleRefreshAllNetworkData,
    network?.isAllNetworks,
    run,
    runLpTokenList,
    showLpTokensOnly,
  ]);

  useEffect(() => {
    const removeSubscription = onVisibilityStateChange((visible) => {
      if (visible && isFocused && isRouteFocused) {
        handleRefreshOnVisibilityActive();
      }
    });
    return removeSubscription;
  }, [handleRefreshOnVisibilityActive, isFocused, isRouteFocused]);

  useEffect(() => {
    const fn = () => {
      if (network?.isAllNetworks) {
        if (showLpTokensOnly) {
          void runLpTokenList({ alwaysSetState: true });
          return;
        }
        void runAllNetworksRequests({ alwaysSetState: true });
      }
    };
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddDBAccountsToWallet, fn);
    };
  }, [
    network?.isAllNetworks,
    runAllNetworksRequests,
    runLpTokenList,
    showLpTokensOnly,
  ]);

  const handleRefreshAllNetworkDataByAccounts = useCallback(
    async (accounts: { accountId: string; networkId: string }[]) => {
      if (showLpTokensOnly) {
        await runLpTokenList({ alwaysSetState: true });
        return;
      }

      for (const { accountId, networkId } of accounts) {
        await handleAllNetworkRequests({
          accountId,
          networkId,
          allNetworkDataInit: false,
          isSingleRequest: true,
        });
      }
    },
    [handleAllNetworkRequests, runLpTokenList, showLpTokensOnly],
  );

  usePromiseResult(
    async () => {
      // refresh will be handled in RecentHistory
      if (showRecentHistory) return;

      if (!account || !network) return;

      if (!network.isAllNetworks) return;

      if (isNil(allNetworkAccounts)) return;

      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
      });

      if (r.accountsWithChangedTxs.length > 0) {
        void handleRefreshAllNetworkDataByAccounts(r.accountsWithChangedTxs);
      }
    },
    [
      account,
      allNetworkAccounts,
      handleRefreshAllNetworkDataByAccounts,
      network,
      showRecentHistory,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  useEffect(() => {
    const refresh = (
      params:
        | {
            accounts: { accountId: string; networkId: string }[];
          }
        | undefined,
    ) => {
      if (showLpTokensOnly) {
        void runLpTokenList({ alwaysSetState: true });
        return;
      }

      if (network?.isAllNetworks) {
        if (params?.accounts) {
          void handleRefreshAllNetworkDataByAccounts(params.accounts);
        } else {
          void handleRefreshAllNetworkData();
        }
      } else {
        void run();
      }
    };

    const fn = () => {
      if (isFocused) {
        refresh(undefined);
      }
    };
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, fn);
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, fn);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, fn);
    };
  }, [
    handleRefreshAllNetworkData,
    handleRefreshAllNetworkDataByAccounts,
    isFocused,
    network?.isAllNetworks,
    run,
    runAllNetworksRequests,
    runLpTokenList,
    showLpTokensOnly,
  ]);

  useEffect(() => {
    if (isEmptyAccount) {
      perfTokenListView.markEnd('tokenListRefreshing_emptyAccount');
      updateTokenListState({
        initialized: true,
        isRefreshing: false,
      });
      updateAccountOverviewState({
        initialized: true,
        isRefreshing: false,
      });
    }
  }, [isEmptyAccount, updateAccountOverviewState, updateTokenListState]);

  const [allNetworksState] = useAllNetworksStateStateAtom();
  const isAllNetworkEmptyAccount = useMemo(() => {
    if (network?.isAllNetworks) {
      return allNetworksState.visibleCount === 0;
    }
    return false;
  }, [allNetworksState.visibleCount, network?.isAllNetworks]);

  const renderSubTitle = useCallback(() => {
    if (tableLayout) {
      if (!tokenListState.initialized && tokenListState.isRefreshing) {
        return <Skeleton.HeadingLg />;
      }

      return (
        <NumberSizeableTextWrapper
          hideValue
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {accountTokensValue}
        </NumberSizeableTextWrapper>
      );
    }

    return null;
  }, [
    tableLayout,
    settings.currencyInfo.symbol,
    accountTokensValue,
    tokenListState.initialized,
    tokenListState.isRefreshing,
  ]);

  const renderHeaderActions = useCallback(() => {
    const filterSwitch = (
      <TokenSelectorLpTokenSwitch
        value={showLpTokensOnly}
        onChange={handleLpTokenFilterChange}
      />
    );

    if (manageTokenEnabled && tableLayout) {
      return (
        <XStack alignItems="center" gap="$2">
          {filterSwitch}
          <IconButton
            testID="home-render-header-actions-icon-btn"
            title={intl.formatMessage({
              id: ETranslations.manage_token_title,
            })}
            variant="tertiary"
            icon="SliderHorOutline"
            onPress={handleOnManageToken}
            size="medium"
          />
        </XStack>
      );
    }

    return filterSwitch;
  }, [
    tableLayout,
    intl,
    manageTokenEnabled,
    handleOnManageToken,
    showLpTokensOnly,
    handleLpTokenFilterChange,
  ]);

  const renderContent = useCallback(() => {
    return (
      <TokenListView
        limit={6}
        plainMode
        withHeader
        withFooter
        withPrice
        inTabList
        hideValue
        withSwapAction
        showActiveAccountTokenList={showLpTokensOnly}
        scopedActiveAccountTokenList={scopedLpTokenList}
        scopedActiveAccountTokenListState={scopedLpTokenListState}
        scopedActiveAccountTokenListMap={scopedLpTokenListMap}
        hideDeFiMarkedTokens={!showLpTokensOnly}
        accountId={account?.id ?? ''}
        networkId={network?.id ?? ''}
        indexedAccountId={indexedAccount?.id ?? ''}
        mergeDeriveAddressData={!!mergeDeriveAddressData}
        allAggregateTokenMap={allAggregateTokenMap}
        showNetworkIcon={!!network?.isAllNetworks}
        hideZeroBalanceTokens={
          showLpTokensOnly ? false : !!network?.isAllNetworks
        }
        deferTokenManagement={!!network?.isAllNetworks}
        manageTokenEnabled={manageTokenEnabled}
        onManageToken={handleOnManageToken}
        onPressToken={handleOnPressToken}
        isAllNetworks={network?.isAllNetworks}
        homeDefaultTokenMap={homeDefaultTokenMap}
        tableLayout={tableLayout}
        emptyAccountView={
          isAllNetworkEmptyAccount ? (
            <Stack py="$20">
              <EmptyAccount
                createAllDeriveTypes
                createAllEnabledNetworks
                autoCreateAddress={false}
                name={accountName}
                chain={network?.name ?? ''}
                type={
                  (deriveInfo?.labelKey
                    ? intl.formatMessage({
                        id: deriveInfo?.labelKey,
                      })
                    : deriveInfo?.label) ?? ''
                }
              />
            </Stack>
          ) : null
        }
        listViewStyleProps={{
          ListHeaderComponentStyle: {
            pt: '$3',
          },
        }}
      />
    );
  }, [
    account?.id,
    accountName,
    allAggregateTokenMap,
    tableLayout,
    deriveInfo?.label,
    deriveInfo?.labelKey,
    handleOnManageToken,
    handleOnPressToken,
    homeDefaultTokenMap,
    indexedAccount?.id,
    intl,
    isAllNetworkEmptyAccount,
    manageTokenEnabled,
    mergeDeriveAddressData,
    network?.id,
    network?.isAllNetworks,
    network?.name,
    scopedLpTokenList,
    scopedLpTokenListMap,
    scopedLpTokenListState,
    showLpTokensOnly,
  ]);

  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      })}
      subTitle={renderSubTitle()}
      headerActions={renderHeaderActions()}
      headerContainerProps={{ px: '$pagePadding' }}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { TokenListBlock };
