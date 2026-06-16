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
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { EmptyAccount } from '@onekeyhq/kit/src/components/Empty';
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
import { useIsDeFiEnabled } from '@onekeyhq/kit/src/hooks/useIsDeFiEnabled';
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
  useListStructureAtom,
  useTokenListActions,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useTokenListContextData } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms';
import {
  useTokenListCellsColdStartHydrate,
  useTokenListCellsProducer,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells';
import {
  aggCell,
  cell,
  meta,
  subcell,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/projection';
import { buildTapTimeHomeTokenMap } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/tapTimeHomeMap';
import { useTokenManagement } from '@onekeyhq/kit/src/views/AssetList/hooks/useTokenManagement';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ISimpleDBAggregateToken } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAggregateToken';
import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IRiskTokenManagementDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityRiskTokenManagement';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isAgg } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
  POLLING_INTERVAL_FOR_TOKEN,
  TOKEN_LIST_HIGH_VALUE_MAX,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IAppEventBusPayload,
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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  buildTokenSelectorDappTokenFilterParams,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  buildAggregateTokenListData,
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
import {
  isUnavailableOrZeroFiatValue,
  sumFiatValuesFromTokens,
  sumTokenGroupsFiatValueIgnoringUnavailable,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  ICustomTokenItem,
  IFetchAccountTokensResp,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { RichBlock } from '../RichBlock/RichBlock';

const networkIdsMap = getNetworkIdsMap();

/**
 * TokenList cells Phase-2 BG — DARK / flag-OFF dual-write gate (design §5 step 2,
 * D5). When ON, the home refresh flow ALSO hands each settled fetch round to the
 * BG `serviceTokenViewModel.ingestRound(...)` (which builds + pushes the BG
 * frames). When OFF (the PR-1 default), `ingestRound` is NEVER called and there
 * is zero behavior change — the UI stays driven by `useTokenListCellsProducer` +
 * the legacy atoms. Cut-over (UI consuming the BG frames, H4 death) is PR-2.
 */
const ENABLE_BG_TOKEN_VIEW_MODEL = true;

type ITokenSelectorFilterMode = 'wallet-token' | 'lp-dapp-token';

type IAllNetworkTokenListResp = IFetchAccountTokensResp & {
  tokenSelectorFilterMode: ITokenSelectorFilterMode;
  syncTokenFilterToOverview: boolean;
  // Active owner at request time. `updateAllNetworksTokenList` reprocesses
  // the retained `allNetworksResult` whenever its identity changes — which
  // includes owner switches, where the result still belongs to the PREVIOUS
  // owner (usePromiseResult keeps the last resolved value). These fields let
  // it refuse to stamp the new owner over another owner's data.
  ownerAccountId?: string;
  ownerNetworkId?: string;
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
  // TokenList cells Phase-2 BG dual-write inputs (DARK / flag-OFF — design §5
  // step 2). The owner key + hideZero inputs are computed later in the body
  // (`cellsOwnerKey` / `cellsNonZeroInputs`); the refresh callbacks above read them
  // off this ref so the dead-when-OFF `ingestRound` call adds no render deps and
  // never reaches uninitialized consts.
  const cellsIngestInputsRef = useRef<{
    ownerKey: string;
    nonZeroInputs: {
      keepDefault?: boolean;
      homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
      customTokens?: ICustomTokenItem[];
    };
  }>({ ownerKey: '', nonZeroInputs: {} });
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const isDeFiEnabled = useIsDeFiEnabled(network?.id);
  const showLpTokenFilterSwitch =
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network,
      isDeFiEnabled,
    });
  const showLpTokensOnly = showLpTokenFilterSwitch
    ? tokenSelectorFilter.homeShowLpTokensOnly
    : false;
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
  const [isLpTokenSwitchLoading, setIsLpTokenSwitchLoading] = useState(false);
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
  // DeFi-token mode is display-only here. Wallet-token loading must keep
  // running so account worth, aggregate-token cache, and send/receive selectors
  // are hydrated even when the visible Home list is showing DeFi tokens.
  const tokenSelectorFilterMode =
    buildTokenSelectorFilterMode(showLpTokensOnly);
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
  const refreshWalletTokenListRef = useRef<(() => void) | undefined>(undefined);
  const syncTokenFilterToOverview = true;

  const accountTokensValue = useMemo(
    () =>
      calculateAccountTokensValue({
        accountId: account?.id ?? '',
        networkId: network?.id ?? '',
        tokensWorth: accountTokensWorth,
        mergeDeriveAssetsEnabled: !!vaultSettings?.mergeDeriveAssetsEnabled,
      }),
    [
      account?.id,
      network?.id,
      accountTokensWorth,
      vaultSettings?.mergeDeriveAssetsEnabled,
    ],
  );

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

  const { updateTokenListState, updateSearchKey } =
    useTokenListActions().current;

  const {
    updateAccountWorth,
    updateAccountOverviewState,
    updateAllNetworksState,
  } = useAccountOverviewActions().current;

  // full-delete PR-7: the home tokenList cells store + structure. The tap-time
  // TokenDetails `tokenMap` / `aggregateTokens` route params are rebuilt from
  // the live per-store cells over this structure (replacing the deleted
  // `tokenListMapAtom` / `aggregateTokensListMapAtom` reads). TokenListBlock
  // mounts the cells producer (`useTokenListCellsProducer` below), so it runs under
  // the home tokenList provider and these resolve to the home store.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const tokenListStore = useTokenListContextData().store!;
  const [listStructure] = useListStructureAtom();

  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      if (value === showLpTokensOnly) {
        return;
      }
      setIsLpTokenSwitchLoading(!!value && !!account?.id && !!network?.id);
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
        setIsLpTokenSwitchLoading(false);
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
      try {
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

        await backgroundApiProxy.serviceToken.abortFetchAccountTokens({
          excludedFlags: ['token-selector'],
        });

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
              const key = accountUtils.buildAccountValueKey({
                accountId: item.accountId,
                networkId: item.networkId,
              });
              // Unavailable tokens are silently dropped from the per-network
              // total — partial sum keeps the top balance trustworthy while
              // the row-level '--' still surfaces the broken entry.
              accountWorth[key] =
                sumTokenGroupsFiatValueIgnoringUnavailable(item);
            }
          });

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

          const accountWorth = sumTokenGroupsFiatValueIgnoringUnavailable(r);

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
                })]: accountWorth,
              },
              createAtNetworkWorth: accountWorth,
              merge: false,
            });
          }
        }

        // TokenList cells Phase-2 BG dual-write (DARK / flag-OFF — design §5 step
        // 2). Hand the SAME settled slices this single-network round just wrote
        // to the atoms over to the BG view-model so it can build + push the BG
        // frames in parallel. No-op when the flag is OFF (the PR-1 default), so
        // there is zero behavior change. The single-network path has no
        // aggregate tokens, so the nested aggregate map is empty. Owner key +
        // hideZero inputs are read off a ref (assigned next to the cells consts)
        // so this dead-when-OFF call needs no extra render deps.
        if (ENABLE_BG_TOKEN_VIEW_MODEL) {
          void backgroundApiProxy.serviceTokenViewModel.ingestRound({
            ownerKey: cellsIngestInputsRef.current.ownerKey,
            orderedTokens: r.tokens.data,
            smallBalanceTokens: r.smallBalanceTokens.data,
            tokenListMap: {
              ...r.tokens.map,
              ...r.smallBalanceTokens.map,
            },
            aggregateTokensMap: {},
            // Single-network rounds have no aggregate tokens — empty list-map.
            ownedAggregateTokenListMap: {},
            smallBalanceFiatValue: r.smallBalanceTokens.fiatValue ?? '0',
            storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
            keepDefault: cellsIngestInputsRef.current.nonZeroInputs.keepDefault,
            homeDefaultTokenMap:
              cellsIngestInputsRef.current.nonZeroInputs.homeDefaultTokenMap,
            customTokens:
              cellsIngestInputsRef.current.nonZeroInputs.customTokens,
            // Risky slice (design §R0 #5) — already settled in scope on `r`.
            // Carried so the BG VM can build the dedicated risky frame + merged
            // raw list. Risk tokens are NOT in the home structure/valuation
            // frames (those are risk-blind).
            riskyTokens: r.riskTokens.data,
            riskyMap: r.riskTokens.map,
            // SETTLED owner identity for the `getRawTokenList` switch skeleton.
            accountId: account?.id,
            networkId: network?.id,
            rawKeys: r.allTokens?.keys ?? '',
          });
        }

        if (r.allTokens) {
          const mergedTokens = r.allTokens.data;
          if (mergedTokens && mergedTokens.length) {
            void backgroundApiProxy.serviceToken.updateLocalTokens({
              networkId: network.id,
              tokens: mergedTokens,
            });
          }
        }

        perfTokenListView.markEnd(
          'tokenListRefreshing_tokenListContainerRefreshList',
        );
        updateTokenListState({
          initialized: true,
          isRefreshing: false,
        });

        endTokenListRefreshEvent();
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
      indexedAccount?.id,
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
        setIsLpTokenSwitchLoading(false);
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
        if (requestContext.tokenSelectorFilterMode !== 'lp-dapp-token') {
          setIsLpTokenSwitchLoading(false);
        }
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
          onlyBackendIndexedNetworks: showLpTokensOnly,
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
        if (e instanceof CanceledError) {
          console.log('fetchFilteredTokenSelectorTokens canceled');
        } else {
          console.error(e);
        }
      } finally {
        if (isLatestRequest()) {
          setScopedLpTokenListState({
            initialized: true,
            isRefreshing: false,
          });
          setIsLpTokenSwitchLoading(false);
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
      // Persisted DeFi-token mode can mount before Home focus settles after a
      // renderer refresh. The scoped DeFi list owns its loading state, so the
      // cold-start request must not be dropped by the Home focus gate after the
      // list has already been cleared to skeleton.
      checkIsFocused: false,
    },
  );

  useLayoutEffect(() => {
    if (!showLpTokensOnly || !account?.id || !network?.id) {
      setIsLpTokenSwitchLoading(false);
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

  // Active-owner snapshot as of this instance's LAST RENDER (stale while the
  // tab is frozen — matching the equally stale closures it is compared
  // against, so the guard never misfires under freeze). In-flight async
  // writers' closures capture the owner a request was issued FOR; comparing
  // them against this ref lets post-await write paths drop stale cross-owner
  // responses (detached history-loop refreshes, un-aborted fetches from a
  // previous owner) instead of writing over atoms already cleared and
  // re-stamped for the new owner.
  const activeOwnerRef = useRef<{ accountId?: string; networkId?: string }>({});
  activeOwnerRef.current = { accountId: account?.id, networkId: network?.id };

  // TokenList cells producer (spec §4.1, §6). Observes the settled atoms the
  // refresh* writers above land into and projects each fetch round into the
  // structure atom + per-key cells (structure only on structural change, pure
  // price ticks emit valuation only). The existing refresh* writers are
  // unchanged — risky/allTokenList stay whole-object. The owner key matches the
  // per-owner cache axis (indexedAccountId in merge mode) so it survives
  // derive-type switches the same way the cache does.
  const cellsOwnerKey = useMemo(() => {
    const ownerAccountId = getTokenListOwnerCacheAccountId({
      accountId: account?.id,
      indexedAccountId: indexedAccount?.id,
      mergeDeriveAddressData: !!mergeDeriveAddressData,
    });
    return ownerAccountId && network?.id
      ? `${ownerAccountId}__${network.id}`
      : '';
  }, [account?.id, indexedAccount?.id, mergeDeriveAddressData, network?.id]);
  // Current settings currency id — the slim cold-start bundle stores fiat in
  // this currency and the T0 hydrate gates re-use against it (spec §7, §3#3).
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const cellsCurrencyId = currencyInfo?.id ?? '';
  // T0 cold-start fan-out hydrate (spec §7). Runs eagerly, once per owner,
  // before the async fetch — paints rows + price + name/icon at cold start via
  // the SAME apply contract the producer uses; also schedules the one-time
  // version-flag purge of the OLD persisted cold-start key on HomePageReady.
  useTokenListCellsColdStartHydrate(cellsOwnerKey, cellsCurrencyId);
  // Resolve the parsed customTokens for the cells producer's hideZero
  // `nonZeroIds` authority (spec §8#2, PR-S Step 3). Mirrors the
  // `useTokenManagement` call inside TokenListViewCmp (deferred on all-networks
  // until the list state initializes) so the producer feeds the SAME custom
  // tokens the in-view hideZero predicate uses.
  const deferCellsTokenManagement = !!network?.isAllNetworks;
  const { customTokens: cellsCustomTokens } = useTokenManagement({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    indexedAccountId: indexedAccount?.id,
    enabled: !deferCellsTokenManagement || tokenListState.initialized,
  });
  const cellsNonZeroInputs = useMemo(
    () => ({
      // Home keeps default zero-balance tokens (TokenListView defaults
      // keepDefaultZeroBalanceTokens=true on the home path).
      keepDefault: true,
      homeDefaultTokenMap,
      customTokens: cellsCustomTokens,
    }),
    [homeDefaultTokenMap, cellsCustomTokens],
  );
  useTokenListCellsProducer(cellsOwnerKey, cellsCurrencyId, cellsNonZeroInputs);

  // Keep the BG dual-write inputs ref current so the refresh callbacks can hand
  // the right owner + hideZero inputs to `serviceTokenViewModel.ingestRound`
  // (DARK / flag-OFF — design §5 step 2).
  cellsIngestInputsRef.current = {
    ownerKey: cellsOwnerKey,
    nonZeroInputs: cellsNonZeroInputs,
  };

  const updateAllNetworkData = useThrottledCallback(() => {
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
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
      allNetworkDataInit?: boolean;
      isSingleRequest?: boolean;
    }) => {
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
        tokenSelectorFilterMode: 'wallet-token',
        syncTokenFilterToOverview,
        // Closure values — this callback is recreated per owner, so these are
        // the owner this request was issued for.
        ownerAccountId: account?.id,
        ownerNetworkId: network?.id,
      };

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

      // The active owner may have changed during the awaits above (detached
      // history-loop refresh, un-aborted fetch from a previous owner). Writing
      // would land this owner's data on atoms already cleared and re-stamped
      // for the new owner — and the next same-owner stamp write would then
      // vouch for it.
      const isStaleOwnerRequest = () =>
        activeOwnerRef.current.accountId !== account?.id ||
        activeOwnerRef.current.networkId !== network?.id;

      if (
        !allNetworkDataInit &&
        r.isSameAllNetworksAccountData &&
        !isStaleOwnerRequest()
      ) {
        const accountWorth = sumTokenGroupsFiatValueIgnoringUnavailable(r);
        let createAtNetworkWorth = '0';

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
              })]: accountWorth,
            },
            createAtNetworkWorth,
            merge: true,
          });
        }

        // Re-check the owner — it can switch mid-flight.
        if (isStaleOwnerRequest()) {
          isAllNetworkManualRefresh.current = false;
          return r;
        }

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

        // TokenList cells Phase-2 BG cutover (design §5 PR-2 step 1). The
        // per-round all-network ingestRound was REMOVED here: this round's
        // `r.tokens.data` is ONE incremental slice, NOT the coherent full list,
        // so feeding it would make the BG structure frame reflect a partial
        // round. The all-network feed now happens ONCE, at the tail of the
        // `allNetworksResult` consuming effect, after merge/dedup/sort/high-low
        // split have produced the coherent full merged snapshot.

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
      updateAccountOverviewState,
      updateAccountWorth,
      updateAllNetworkData,
      updateTokenListState,
      syncTokenFilterToOverview,
      walletTokenFilterParams,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    // Cancel the pending throttled flush and discard its accumulation —
    // otherwise a trailing `updateAllNetworkData` fires after this clear and
    // merges the previous owner's tokens into the freshly stamped-empty list
    // (the owner stamp written below would then claim that data is current).
    updateAllNetworkData.cancel();
    tokenListRef.current.tokens = [];
    tokenListRef.current.keys = '';
    tokenListRef.current.map = {};
    riskyTokenListRef.current.tokens = [];
    riskyTokenListRef.current.keys = '';
    riskyTokenListRef.current.map = {};
  }, [updateAllNetworkData]);

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
        currency?: string;
      }[];
      accountId: string;
      networkId: string;
    }) => {
      perfTokenListView.markStart('handleAllNetworkCacheData');

      // Refresh the shared cached aggregate raw data (consumed by the
      // single-network aggregate-build path / `updateAllNetworkData`). The
      // legacy `allTokenList*` cache-hydrate that also lived here was deleted in
      // the tokenList cells §R2+R3 cutover — the cells slim cold cache + ingestRound
      // are now the single cache/paint authority — so the per-network token list
      // assembly that fed those writers is gone too.
      aggregateTokenRawData.current =
        (await backgroundApiProxy.simpleDb.aggregateToken.getRawData()) ??
        undefined;

      // Per-account worth map for the overview update below.
      let tokenListValue: Record<string, string> = {};
      const hasAnyCache = data.some((item) => item.hasCache);
      data.forEach((item) => {
        tokenListValue = {
          ...tokenListValue,
          [accountUtils.buildAccountValueKey({
            accountId: item.accountId,
            networkId: item.networkId,
          })]: item.tokenListValue,
        };
      });

      if (syncTokenFilterToOverview) {
        setOverviewTokenCacheState({
          ownerKey: buildOverviewOwnerKey(accountId, networkId),
          hasCache: hasAnyCache,
        });
      }

      if (hasAnyCache) {
        if (syncTokenFilterToOverview) {
          // All items share the storage currency (same multi-network fetch);
          // fall back to USD when the cache is empty.
          const cacheCurrency =
            data.find((d) => d.currency)?.currency ?? USD_CURRENCY_ID;
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
            currency: cacheCurrency,
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
      setOverviewTokenCacheState,
      syncTokenFilterToOverview,
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
  });

  const updateAllNetworksTokenList = useCallback(async () => {
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
        resultTokenSelectorFilterMode !== 'wallet-token' ||
        hasMixedTokenSelectorFilterResult
      ) {
        return;
      }
      // This callback's identity changes on owner switch, re-firing the
      // consuming effect while `allNetworksResult` still holds the PREVIOUS
      // owner's completed fan-out (usePromiseResult keeps the last resolved
      // value). Reprocessing it would replace every token atom with that
      // owner's data, write its worth under the new owner's accountId, and
      // stamp `allTokenList` with the new owner — vouching for foreign data.
      if (
        allNetworksResult[0].ownerAccountId !== account?.id ||
        allNetworksResult[0].ownerNetworkId !== network?.id
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

        const accountWorth = sumTokenGroupsFiatValueIgnoringUnavailable(r);

        accountsWorth[
          accountUtils.buildAccountValueKey({
            accountId: r.accountId ?? '',
            networkId: r.networkId ?? '',
          })
        ] = accountWorth;

        if (
          account?.id &&
          (!accountUtils.isOthersAccount({ accountId: account.id }) ||
            (accountUtils.isOthersAccount({ accountId: account.id }) &&
              account?.createAtNetwork &&
              account.createAtNetwork === r.networkId))
        ) {
          createAtNetworkWorth = createAtNetworkWorth.plus(accountWorth);
        }
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
        isUnavailableOrZeroFiatValue(mergeTokenListMap[token.$key]?.fiatValue),
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

      smallBalanceTokensFiatValue = sumFiatValuesFromTokens(
        smallBalanceTokenList.smallBalanceTokens,
        mergeTokenListMap,
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

      // TokenList cells Phase-2 BG cutover (design §5 PR-2 step 1). Feed the BG
      // view-model the COHERENT FULL merged snapshot this effect just produced —
      // post merge/dedup ($key uniqBy) / sortTokensByFiatValue / zero-balance
      // re-sort / high-low split (TOKEN_LIST_HIGH_VALUE_MAX) — NOT an
      // incremental round. `ingestRound` REPLACES the owner's slices each call,
      // so `vm.lastStructure` compares full-vs-full and the structure frame
      // reflects the whole current list. The legacy refresh* writes above remain
      // the single source of merge truth during the transition window (PR-3
      // removes the atom writers); the VM is fed the already-merged result, no
      // duplicated merge logic in the VM yet (design §3 defers that).
      if (ENABLE_BG_TOKEN_VIEW_MODEL) {
        void backgroundApiProxy.serviceTokenViewModel.ingestRound({
          ownerKey: cellsIngestInputsRef.current.ownerKey,
          orderedTokens: tokenList.tokens,
          smallBalanceTokens: smallBalanceTokenList.smallBalanceTokens,
          tokenListMap: mergeTokenListMap,
          aggregateTokensMap: aggregateTokenMap,
          // The owned aggregate sub-token list map, carried onto the structure
          // frame so the home cell-path leaves source the owned aggregate
          // sub-token list from `listStructureAtom`.
          ownedAggregateTokenListMap: aggregateTokenListMap,
          smallBalanceFiatValue: smallBalanceTokensFiatValue.toFixed(),
          storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
          keepDefault: cellsIngestInputsRef.current.nonZeroInputs.keepDefault,
          homeDefaultTokenMap:
            cellsIngestInputsRef.current.nonZeroInputs.homeDefaultTokenMap,
          customTokens: cellsIngestInputsRef.current.nonZeroInputs.customTokens,
          // Risky slice (design §R0 #5) — the coherent FULL risky set this
          // effect just produced (post merge/dedup/sort). Carried so the BG VM
          // can build the dedicated risky frame + merged raw list.
          riskyTokens: riskyTokenList.riskyTokens,
          riskyMap: riskyTokenListMap,
          // SETTLED owner identity for the `getRawTokenList` switch skeleton —
          // mirrors the legacy `allTokenListAtom` write just below.
          accountId: account?.id,
          networkId: network?.id,
          rawKeys: `${tokenList.keys}_${smallBalanceTokenList.keys}_${riskyTokenList.keys}`,
        });
      }

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
    updateAccountWorth,
    updateTokenListState,
  ]);

  // full-delete PR-7: the legacy per-owner `renderedTokenListCache` pre-paint
  // hydrator was REMOVED here. Both jobs it did on home are now covered without
  // a whole-map read: (1) cold paint is the slim cold cache fan-out
  // (`useTokenListCellsColdStartHydrate`), and (2) switch-hydrate (byOwner instant
  // swap) is the BG producer's SUBSCRIBE-THEN-PULL (`useTokenListCellsProducer` →
  // `getTokenListFrames`) backed by the per-owner VM cache in the BG heap. This
  // effect only ever wrote the legacy home atoms (now cell-fed) from the cache,
  // so dropping it frees the last `renderedTokenListCacheAtom` reader in this
  // file. Its `refresh*` writers stay until PR-8.

  useEffect(() => {
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
      let tokenListValue = '0';
      let tokenListWorth: Record<string, string> = {};
      let hasLocalTokenCache = false;
      let cachedWorthCurrency: string | undefined;

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
        // All `resp` entries come from the same multi-network request and
        // share the storage currency; pick the first non-empty tag.
        cachedWorthCurrency = resp.find((r) => r.currency)?.currency;

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
      } else {
        const localTokens =
          await backgroundApiProxy.serviceToken.getAccountLocalTokens({
            accountId,
            networkId,
            accountAddress,
            xpub,
          });
        hasLocalTokenCache = localTokens.hasCache;
        cachedWorthCurrency = localTokens.currency;

        tokenList = localTokens.tokenList;
        smallBalanceTokenList = localTokens.smallBalanceTokenList;
        riskyTokenList = localTokens.riskyTokenList;
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
            currency: cachedWorthCurrency,
          });
          // Without these refresh calls the token list atoms keep the
          // previous owner's data, leaving allTokenList.accountId/networkId
          // stale and triggering the owner-mismatch skeleton in TokenListView
          // forever for this empty-cache target.
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
          currency: cachedWorthCurrency,
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
    setOverviewTokenCacheState,
    syncTokenFilterToOverview,
    updateAccountOverviewState,
    updateAccountWorth,
    updateSearchKey,
    updateTokenListState,
    wallet?.id,
  ]);

  useEffect(() => {
    void updateAllNetworksTokenList();
  }, [updateAllNetworksTokenList]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      refreshWalletTokenListRef.current?.();
      if (showLpTokensOnly) {
        void runLpTokenList({ alwaysSetState: true });
      }
    }
  }, [isHeaderRefreshing, runLpTokenList, showLpTokensOnly]);

  const handleOnPressToken = useCallback(
    async (token: IAccountToken) => {
      if (!network || !wallet || !deriveInfo || !deriveType) return;

      // full-delete PR-7: the TokenDetails route params (`tokenMap` /
      // `aggregateTokens`) were the LAST readers of `tokenListMapAtom` /
      // `aggregateTokensListMapAtom` in this file. Both are now sourced from the
      // live HOME cells store at tap time (cells + `listStructureAtom`), which is
      // the BG-fed merged home data spanning ALL networks. A non-reactive
      // tap-time read is correct (route params are a plain serializable
      // snapshot; the tap is not perf-critical).

      // BLOCKER 1 — aggregate sub-token list. The home persists the aggregate
      // list-map keyed by the REAL home owner (`network.id` / `account.id`), NOT
      // the tapped token's mock `aggregate--0` networkId. Source it from the
      // producer-wired `ownedAggregateTokenListMap` on `listStructureAtom` (it IS
      // the home owner full map); fall back to the local store under the HOME
      // owner key when the structure has not been hydrated yet.
      let aggregateTokens =
        listStructure.ownedAggregateTokenListMap[token.$key]?.tokens;
      if (!aggregateTokens) {
        const homeAggregateListMap =
          await backgroundApiProxy.serviceToken.getLocalAggregateTokenListMap({
            accountId: account?.id ?? '',
            networkId: network.id,
          });
        aggregateTokens = homeAggregateListMap[token.$key]?.tokens ?? [];
      }

      // BLOCKER 2 — full merged home `tokenMap`. The old value was the whole
      // `tokenListMapAtom` (all networks). A network-scoped read drops the
      // other-network aggregate sub-tokens (they would sort as 0 and get no
      // balance seed). Rebuild the full map from the live cells over the home
      // structure ids (same cell-reconstruction pattern as TokenListFooter,
      // PR-4): normal ids -> cell, aggregate ids -> aggCell (the flattened row)
      // plus each owned sub-token's per-network subcell keyed by the sub-token
      // `$key` (the key TokenDetails rebuilds for its sort + seed).
      const tokenMap = buildTapTimeHomeTokenMap(
        {
          orderedIds: listStructure.orderedIds,
          smallBalanceIds: listStructure.smallBalanceIds,
          aggMembership: listStructure.aggMembership,
          ownedAggregateTokenListMap: listStructure.ownedAggregateTokenListMap,
        },
        {
          readMeta: (key) => tokenListStore.get(meta(tokenListStore, key)),
          readCell: (key) => tokenListStore.get(cell(tokenListStore, key)),
          readAggCell: (aggKey) =>
            tokenListStore.get(aggCell(tokenListStore, aggKey)),
          readSubCell: (aggKey, networkId) =>
            tokenListStore.get(subcell(tokenListStore, aggKey, networkId)),
          isAgg,
        },
      );

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
          aggregateTokens,
          tokenMap,
        },
      });
    },
    [
      account?.address,
      account?.id,
      deriveInfo,
      deriveType,
      indexedAccount?.id,
      listStructure.aggMembership,
      listStructure.orderedIds,
      listStructure.ownedAggregateTokenListMap,
      listStructure.smallBalanceIds,
      navigation,
      network,
      tokenListStore,
      wallet,
    ],
  );

  const handleRefreshAllNetworkData = useCallback(() => {
    isAllNetworkManualRefresh.current = true;
    void runAllNetworksRequests({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
  }, [runAllNetworksRequests]);

  refreshWalletTokenListRef.current = () => {
    if (network?.isAllNetworks) {
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
      refreshWalletTokenListRef.current?.();
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
        void runAllNetworksRequests({ alwaysSetState: true });
        if (showLpTokensOnly) {
          void runLpTokenList({ alwaysSetState: true });
        }
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
      for (const { accountId, networkId } of accounts) {
        await handleAllNetworkRequests({
          accountId,
          networkId,
          allNetworkDataInit: false,
          isSingleRequest: true,
        });
      }
      if (showLpTokensOnly) {
        await runLpTokenList({ alwaysSetState: true });
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

  // Imperatively refresh the single-network wallet token list for an
  // explicitly provided account/network. Used when a refresh is emitted from
  // another home tab right after a network switch: this list may be frozen
  // (inactive tab), so its own `run` closures still point at the previous
  // network. Driving the fetch from explicit params lets the always-visible
  // header worth (and the shared token-list atoms) update to the new network
  // without waiting for the user to return to this tab.
  const explicitRefreshSeqRef = useRef(0);
  const refreshSingleNetworkTokenListByTarget = useCallback(
    async (target: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
    }) => {
      const { accountId, networkId, indexedAccountId } = target;
      if (!accountId || !networkId) return;
      // All-networks aggregation is driven by a separate, closure-bound hook
      // that cannot be refreshed imperatively here; let it refresh on return.
      if (networkUtils.isAllNetwork({ networkId })) return;

      explicitRefreshSeqRef.current += 1;
      const seq = explicitRefreshSeqRef.current;
      const isLatest = () => explicitRefreshSeqRef.current === seq;

      let emittedRefreshing = false;
      try {
        // Multi-derive (merge-derive) HD accounts need the parallel
        // per-derivation fetch that only `run` performs; the single-account
        // fast path below would apply partial data, so skip them. Others
        // accounts (imported/watch-only) are always single-address even on
        // merge-derive networks, so they can safely use the fast path here.
        const targetVaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
        if (
          targetVaultSettings?.mergeDeriveAssetsEnabled &&
          !accountUtils.isOthersAccount({ accountId })
        ) {
          return;
        }
        if (!isLatest()) return;

        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: true,
          type: EHomeTab.TOKENS,
          accountId,
          networkId,
        });
        emittedRefreshing = true;

        // Cancel any superseded in-flight wallet token fetch (e.g. a request
        // for the previous network) so its late response can't clobber this
        // network's data. Mirrors the abort in the closure-bound `run` path;
        // the seq guard alone only coordinates between explicit refreshes.
        await backgroundApiProxy.serviceToken.abortFetchAccountTokens({
          excludedFlags: ['token-selector'],
        });
        if (!isLatest()) return;

        const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
          accountId,
          mergeTokens: true,
          networkId,
          flag: 'home-token-list',
          saveToLocal: true,
          indexedAccountId,
          ...walletTokenFilterParams,
        });

        // A newer switch superseded this fetch; drop the stale body so it
        // can't clobber the latest network's data.
        if (!isLatest()) return;

        const accountWorth = sumTokenGroupsFiatValueIgnoringUnavailable(r);
        updateAccountOverviewState({ isRefreshing: false, initialized: true });
        updateAccountWorth({
          accountId,
          initialized: true,
          worth: {
            [accountUtils.buildAccountValueKey({ accountId, networkId })]:
              accountWorth,
          },
          createAtNetworkWorth: accountWorth,
          merge: false,
        });

        if (r.allTokens) {
          // Keep the broader local token directory in sync, like `run` does;
          // `saveToLocal` only persists the per-account token cache.
          const mergedTokens = r.allTokens.data;
          if (mergedTokens && mergedTokens.length) {
            void backgroundApiProxy.serviceToken.updateLocalTokens({
              networkId,
              tokens: mergedTokens,
            });
          }
        }
        updateTokenListState({ initialized: true, isRefreshing: false });
      } catch (e) {
        if (!(e instanceof CanceledError)) {
          throw e;
        }
      } finally {
        if (emittedRefreshing) {
          appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
            isRefreshing: false,
            type: EHomeTab.TOKENS,
            accountId,
            networkId,
          });
        }
      }
    },
    [
      walletTokenFilterParams,
      updateAccountOverviewState,
      updateAccountWorth,
      updateTokenListState,
    ],
  );

  useEffect(() => {
    const refresh = (
      params: IAppEventBusPayload[EAppEventBusNames.RefreshTokenList],
    ) => {
      // A flagged payload (emitted from another home tab right after a network
      // switch) asks this list to refresh against the provided account/network.
      // This list may be frozen with a stale network in its closures, so honor
      // the explicit target instead of falling through to the closure-bound
      // `run` / all-networks paths.
      if (params?.refreshByProvidedAccounts) {
        const target = params.accounts?.[0];
        if (target) {
          void refreshSingleNetworkTokenListByTarget(target);
        }
        return;
      }
      if (network?.isAllNetworks) {
        if (params?.accounts) {
          void handleRefreshAllNetworkDataByAccounts(params.accounts);
        } else {
          void handleRefreshAllNetworkData();
          if (showLpTokensOnly) {
            void runLpTokenList({ alwaysSetState: true });
          }
        }
      } else {
        void run({ alwaysSetState: true });
        if (showLpTokensOnly) {
          void runLpTokenList({ alwaysSetState: true });
        }
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
    refreshSingleNetworkTokenListByTarget,
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
        <Currency
          hideValue
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          sourceCurrency={accountTokensWorth.currency}
        >
          {accountTokensValue}
        </Currency>
      );
    }

    return null;
  }, [
    tableLayout,
    accountTokensWorth.currency,
    accountTokensValue,
    tokenListState.initialized,
    tokenListState.isRefreshing,
  ]);

  const renderHeaderActions = useCallback(() => {
    const filterSwitch = showLpTokenFilterSwitch ? (
      <TokenSelectorLpTokenSwitch
        value={showLpTokensOnly}
        onChange={handleLpTokenFilterChange}
        loading={isLpTokenSwitchLoading}
      />
    ) : null;

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
    showLpTokenFilterSwitch,
    handleLpTokenFilterChange,
    isLpTokenSwitchLoading,
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
        // cells render binding (spec §5): TokenListBlock mounts the cells producer
        // (`useTokenListCellsProducer`), so its global home list may bind leaves
        // to per-key cells. The flag is further gated inside TokenListView so
        // the scoped LP-token override path keeps reading the whole map.
        enableCellSeam
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
