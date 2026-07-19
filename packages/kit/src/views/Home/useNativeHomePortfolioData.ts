import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';
import { POLLING_INTERVAL_FOR_TOKEN } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { buildTokenSelectorDappTokenFilterParams } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { getMergedDeriveTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { useAllNetworkRequests } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import {
  createNativeHomeAllNetworkRequestOutcome,
  filterNativeHomeAllNetworkAuthoritativeResponses,
  recordNativeHomeAllNetworkFailure,
  recordNativeHomeAllNetworkResponse,
  resolveNativeHomeAllNetworkAuthorityStatus,
} from './nativeHomeAllNetworkAuthority';
import {
  type INativeHomeAllNetworkTokenResponse,
  buildNativeHomeAllNetworkPortfolioProjection,
} from './nativeHomeAllNetworkPortfolioProjection';
import {
  type INativeHomeBalanceAuthority,
  type INativeHomeBalanceAuthorityToken,
  buildNativeHomeBalanceScopeKey,
  useNativeHomeBalanceAuthorityOwner,
} from './nativeHomeBalanceAuthority';
import {
  type INativeHomeCustomTokenScope,
  commitNativeHomeSnapshotAfterProjection,
  projectNativeHomeCustomTokens,
} from './nativeHomeCustomTokenProjection';

interface INativeHomeTokenSlice {
  map: Record<string, ITokenFiat>;
  riskMap: Record<string, ITokenFiat>;
  riskTokens: IAccountToken[];
  smallBalanceMap: Record<string, ITokenFiat>;
  smallBalanceTokens: IAccountToken[];
  tokens: IAccountToken[];
}

interface INativeHomeNetworkTokenSlice extends INativeHomeTokenSlice {
  accountId: string;
  mergeDeriveAssets: boolean;
  networkId: string;
}

export interface INativeHomePortfolioData extends INativeHomeTokenSlice {
  balanceAuthority: INativeHomeBalanceAuthority;
  customTokens: ICustomTokenItem[];
  errorCode: string | undefined;
  initialized: boolean;
  isEmptyAccount: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const walletTokenFilterParams = buildTokenSelectorDappTokenFilterParams({
  lpToken: false,
});

function getResponseSlice(
  response: IFetchAccountTokensResp,
): INativeHomeTokenSlice {
  return {
    tokens: response.tokens.data,
    map: response.tokens.map,
    riskTokens: response.riskTokens.data,
    riskMap: response.riskTokens.map,
    smallBalanceTokens: response.smallBalanceTokens.data,
    smallBalanceMap: response.smallBalanceTokens.map,
  };
}

function pickTokenMap(
  tokens: IAccountToken[],
  source: Record<string, ITokenFiat>,
): Record<string, ITokenFiat> {
  const result: Record<string, ITokenFiat> = {};
  tokens.forEach((token) => {
    const fiat = source[token.$key];
    if (fiat) {
      result[token.$key] = fiat;
    }
  });
  return result;
}

function tokenSliceToResponse(
  slice: INativeHomeNetworkTokenSlice,
): INativeHomeAllNetworkTokenResponse {
  return {
    accountId: slice.accountId,
    mergeDeriveAssets: slice.mergeDeriveAssets,
    networkId: slice.networkId,
    tokens: { data: slice.tokens, keys: '', map: slice.map },
    riskTokens: { data: slice.riskTokens, keys: '', map: slice.riskMap },
    smallBalanceTokens: {
      data: slice.smallBalanceTokens,
      keys: '',
      map: slice.smallBalanceMap,
    },
  };
}

export function useNativeHomePortfolioData({
  enabled,
}: {
  enabled: boolean;
}): INativeHomePortfolioData {
  const {
    activeAccount: {
      account,
      network,
      wallet,
      deriveInfoItems,
      vaultSettings,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });
  const [tokens, setTokens] = useState<IAccountToken[]>([]);
  const [map, setMap] = useState<Record<string, ITokenFiat>>({});
  const [riskTokens, setRiskTokens] = useState<IAccountToken[]>([]);
  const [riskMap, setRiskMap] = useState<Record<string, ITokenFiat>>({});
  const [smallBalanceTokens, setSmallBalanceTokens] = useState<IAccountToken[]>(
    [],
  );
  const [smallBalanceMap, setSmallBalanceMap] = useState<
    Record<string, ITokenFiat>
  >({});
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const [customTokens, setCustomTokens] = useState<ICustomTokenItem[]>([]);
  const requestIdRef = useRef(0);
  const allNetworkGenerationRef = useRef(0);
  const customTokensRawDataRef =
    useRef<
      Awaited<
        ReturnType<typeof backgroundApiProxy.simpleDb.customTokens.getRawData>
      >
    >(undefined);
  const riskTokenManagementRawDataRef =
    useRef<
      Awaited<
        ReturnType<
          typeof backgroundApiProxy.simpleDb.riskTokenManagement.getRawData
        >
      >
    >(undefined);
  const aggregateTokenRawDataRef =
    useRef<
      Awaited<
        ReturnType<typeof backgroundApiProxy.simpleDb.aggregateToken.getRawData>
      >
    >(undefined);
  const allNetworkResponsesRef = useRef(
    new Map<string, INativeHomeAllNetworkTokenResponse>(),
  );
  const allNetworkCustomTokenScopesRef = useRef<INativeHomeCustomTokenScope[]>(
    [],
  );
  const accountId = account?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const indexedAccountId = indexedAccount?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const balanceScopeKey = buildNativeHomeBalanceScopeKey({
    accountId,
    networkId,
    walletId,
  });
  const {
    authority: balanceAuthority,
    begin: beginBalanceAuthority,
    settle: settleBalanceAuthority,
  } = useNativeHomeBalanceAuthorityOwner(balanceScopeKey);
  const allNetworkAuthorityTokenRef = useRef<
    INativeHomeBalanceAuthorityToken | undefined
  >(undefined);
  const allNetworkRequestOutcomeRef = useRef(
    createNativeHomeAllNetworkRequestOutcome(),
  );
  const allNetworkExpectedRequestCountRef = useRef(0);
  const allNetworkEmptyAccountsResolvedRef = useRef(false);
  const allNetworkStartedSucceededRef = useRef(false);
  const mergeDerive =
    Boolean(vaultSettings?.mergeDeriveAssetsEnabled) &&
    !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
    deriveInfoItems.length > 1;

  const aggregateCustomTokenScope = useMemo<INativeHomeCustomTokenScope>(
    () => ({
      accountXpubOrAddress: indexedAccountId ?? accountId ?? '',
      networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
    }),
    [accountId, indexedAccountId],
  );
  const applyCustomTokenProjection = useCallback(
    ({
      rawData,
      scopes,
    }: {
      rawData: Awaited<
        ReturnType<typeof backgroundApiProxy.simpleDb.customTokens.getRawData>
      >;
      scopes: INativeHomeCustomTokenScope[];
    }) => {
      setCustomTokens(
        projectNativeHomeCustomTokens({
          rawData,
          scopes: [...scopes, aggregateCustomTokenScope],
        }),
      );
    },
    [aggregateCustomTokenScope],
  );

  const loadSingleCustomTokenProjection = useCallback(async () => {
    if (!accountId || !networkId) {
      return [];
    }
    try {
      const [rawData, accountXpubOrAddress] = await Promise.all([
        backgroundApiProxy.simpleDb.customTokens.getRawData(),
        backgroundApiProxy.serviceAccount.getAccountXpubOrAddress({
          accountId,
          networkId,
        }),
      ]);
      return projectNativeHomeCustomTokens({
        rawData,
        scopes: [
          {
            accountXpubOrAddress: accountXpubOrAddress ?? '',
            networkId,
          },
          aggregateCustomTokenScope,
        ],
      });
    } catch {
      return [];
    }
  }, [accountId, aggregateCustomTokenScope, networkId]);

  const applySlice = useCallback((slice: INativeHomeTokenSlice) => {
    setTokens(slice.tokens);
    setMap(slice.map);
    setRiskTokens(slice.riskTokens);
    setRiskMap(slice.riskMap);
    setSmallBalanceTokens(slice.smallBalanceTokens);
    setSmallBalanceMap(slice.smallBalanceMap);
    setInitialized(true);
  }, []);

  const fetchSingleNetwork = useCallback(
    (childAccountId: string) =>
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        accountId: childAccountId,
        indexedAccountId,
        networkId: networkId ?? '',
        flag: 'home-token-list',
        mergeTokens: true,
        saveToLocal: true,
        ...walletTokenFilterParams,
      }),
    [indexedAccountId, networkId],
  );

  const loadSingle = useCallback(async () => {
    if (!enabled || !accountId || !networkId || isAllNetworks) {
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const authorityToken = beginBalanceAuthority();
    const customTokensTask = loadSingleCustomTokenProjection();
    setIsRefreshing(true);
    setErrorCode(undefined);
    try {
      let slice: INativeHomeTokenSlice;
      if (mergeDerive && indexedAccountId) {
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              indexedAccountId,
              networkId,
              excludeEmptyAccount: true,
            },
          );
        const responses = await Promise.all(
          networkAccounts.map((item) =>
            fetchSingleNetwork(item.account?.id ?? ''),
          ),
        );
        const merged = getMergedDeriveTokenData({
          data: responses,
          mergeDeriveAssetsEnabled: true,
        });
        slice = {
          tokens: merged.tokenList.tokens,
          map: merged.tokenListMap,
          riskTokens: responses.flatMap((item) => item.riskTokens.data),
          riskMap: Object.assign(
            {},
            ...responses.map((item) => item.riskTokens.map),
          ),
          smallBalanceTokens: responses.flatMap(
            (item) => item.smallBalanceTokens.data,
          ),
          smallBalanceMap: Object.assign(
            {},
            ...responses.map((item) => item.smallBalanceTokens.map),
          ),
        };
      } else {
        slice = getResponseSlice(await fetchSingleNetwork(accountId));
      }
      await commitNativeHomeSnapshotAfterProjection({
        commit: ({ projection, snapshot }) => {
          setCustomTokens(projection);
          applySlice(snapshot);
          settleBalanceAuthority(authorityToken, 'success');
        },
        getCurrentGeneration: () => requestIdRef.current,
        generation: requestId,
        projectionTask: customTokensTask,
        snapshot: slice,
      });
    } catch {
      if (requestIdRef.current === requestId) {
        setErrorCode('portfolio_fetch_failed');
        setInitialized(true);
        settleBalanceAuthority(authorityToken, 'error');
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsRefreshing(false);
      }
    }
  }, [
    accountId,
    applySlice,
    beginBalanceAuthority,
    enabled,
    fetchSingleNetwork,
    indexedAccountId,
    isAllNetworks,
    loadSingleCustomTokenProjection,
    mergeDerive,
    networkId,
    settleBalanceAuthority,
  ]);

  const fetchAllNetwork = useCallback(
    async ({
      accountId: childAccountId,
      networkId: childNetworkId,
      dbAccount,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
    }) => {
      try {
        const [response, tokenVaultSettings] = await Promise.all([
          backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: childAccountId,
            indexedAccountId,
            networkId: childNetworkId,
            dbAccount,
            flag: 'home-token-list',
            isAllNetworks: true,
            allNetworksAccountId: accountId,
            allNetworksNetworkId: networkId,
            saveToLocal: true,
            ...walletTokenFilterParams,
            customTokensRawData: customTokensRawDataRef.current ?? undefined,
            blockedTokensRawData:
              riskTokenManagementRawDataRef.current?.blockedTokens,
            unblockedTokensRawData:
              riskTokenManagementRawDataRef.current?.unblockedTokens,
          }),
          backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: childNetworkId,
          }),
        ]);
        const normalizedResponse = {
          ...response,
          accountId: response.accountId ?? childAccountId,
          mergeDeriveAssets:
            tokenVaultSettings?.mergeDeriveAssetsEnabled ?? false,
          networkId: response.networkId ?? childNetworkId,
        } satisfies INativeHomeAllNetworkTokenResponse;
        allNetworkRequestOutcomeRef.current =
          recordNativeHomeAllNetworkResponse(
            allNetworkRequestOutcomeRef.current,
            normalizedResponse,
          );
        return normalizedResponse;
      } catch (error) {
        allNetworkRequestOutcomeRef.current = recordNativeHomeAllNetworkFailure(
          allNetworkRequestOutcomeRef.current,
        );
        throw error;
      }
    },
    [accountId, indexedAccountId, networkId],
  );

  const readAllNetworkCache = useCallback(
    async ({
      accountId: childAccountId,
      networkId: childNetworkId,
      accountAddress,
      xpub,
    }: {
      accountId: string;
      networkId: string;
      accountAddress: string;
      xpub?: string;
    }) => {
      const [cached, tokenVaultSettings] = await Promise.all([
        backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId: childAccountId,
          networkId: childNetworkId,
          accountAddress,
          xpub,
        }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: childNetworkId,
        }),
      ]);
      if (!cached.hasCache) {
        return undefined;
      }
      return {
        accountId: childAccountId,
        mergeDeriveAssets:
          tokenVaultSettings?.mergeDeriveAssetsEnabled ?? false,
        networkId: childNetworkId,
        tokens: cached.tokenList,
        map: pickTokenMap(cached.tokenList, cached.tokenListMap),
        riskTokens: [],
        riskMap: {},
        smallBalanceTokens: [],
        smallBalanceMap: {},
      } satisfies INativeHomeNetworkTokenSlice;
    },
    [],
  );

  const applyAllNetworkCache = useCallback(
    async ({ data: cached }: { data: INativeHomeNetworkTokenSlice[] }) => {
      if (cached.length > 0) {
        const cachedResponses = cached.map(tokenSliceToResponse);
        allNetworkResponsesRef.current = new Map(
          cachedResponses.map((response) => [
            `${response.networkId ?? ''}:${response.accountId ?? ''}`,
            response,
          ]),
        );
        applySlice(
          buildNativeHomeAllNetworkPortfolioProjection({
            responses: cachedResponses,
            aggregateTokenConfigMapRawData:
              aggregateTokenRawDataRef.current?.aggregateTokenConfigMap,
          }),
        );
      }
    },
    [applySlice],
  );

  const handleAllNetworkSettled = useCallback(
    (response: INativeHomeAllNetworkTokenResponse, generation: number) => {
      if (response.isSameAllNetworksAccountData === false) {
        return;
      }
      if (generation < allNetworkGenerationRef.current) {
        return;
      }
      allNetworkGenerationRef.current = generation;
      const responseNetworkId =
        response.networkId ?? response.tokens.data[0]?.networkId ?? '';
      if (!responseNetworkId) {
        return;
      }
      const responseKey = `${responseNetworkId}:${response.accountId ?? ''}`;
      allNetworkResponsesRef.current.set(responseKey, response);
      applySlice(
        buildNativeHomeAllNetworkPortfolioProjection({
          responses: Array.from(allNetworkResponsesRef.current.values()),
          aggregateTokenConfigMapRawData:
            aggregateTokenRawDataRef.current?.aggregateTokenConfigMap,
        }),
      );
    },
    [applySlice],
  );
  const clearAllNetworkData = useCallback(() => {
    setTokens([]);
    setMap({});
    setRiskTokens([]);
    setRiskMap({});
    setSmallBalanceTokens([]);
    setSmallBalanceMap({});
  }, []);
  const handleAllNetworkStarted = useCallback(async () => {
    allNetworkAuthorityTokenRef.current = beginBalanceAuthority();
    allNetworkRequestOutcomeRef.current =
      createNativeHomeAllNetworkRequestOutcome();
    allNetworkExpectedRequestCountRef.current = 0;
    allNetworkEmptyAccountsResolvedRef.current = false;
    allNetworkStartedSucceededRef.current = false;
    setIsRefreshing(true);
    setErrorCode(undefined);
    const [
      customTokensRawData,
      riskTokenManagementRawData,
      initialAggregateTokenRawData,
    ] = await Promise.all([
      backgroundApiProxy.simpleDb.customTokens.getRawData(),
      backgroundApiProxy.simpleDb.riskTokenManagement.getRawData(),
      backgroundApiProxy.simpleDb.aggregateToken.getRawData(),
      accountId && networkId
        ? backgroundApiProxy.serviceToken.updateCurrentAccount({
            accountId,
            networkId,
          })
        : Promise.resolve(),
    ]);
    let aggregateTokenRawData = initialAggregateTokenRawData;
    if (!aggregateTokenRawData?.aggregateTokenConfigMap) {
      await backgroundApiProxy.serviceSetting.syncWalletConfig();
      aggregateTokenRawData =
        await backgroundApiProxy.simpleDb.aggregateToken.getRawData();
    }
    customTokensRawDataRef.current = customTokensRawData;
    riskTokenManagementRawDataRef.current = riskTokenManagementRawData;
    aggregateTokenRawDataRef.current = aggregateTokenRawData;
    applyCustomTokenProjection({
      rawData: customTokensRawData,
      scopes: allNetworkCustomTokenScopesRef.current,
    });
    allNetworkStartedSucceededRef.current = true;
  }, [accountId, applyCustomTokenProjection, beginBalanceAuthority, networkId]);
  const handleAllNetworkAccountsData = useCallback(
    ({ accounts }: { accounts: IAllNetworkAccountInfo[] }) => {
      allNetworkExpectedRequestCountRef.current = accounts.length;
      allNetworkCustomTokenScopesRef.current = accounts.map((item) => ({
        accountXpubOrAddress: item.accountXpub ?? item.apiAddress.toLowerCase(),
        networkId: item.networkId,
      }));
      applyCustomTokenProjection({
        rawData: customTokensRawDataRef.current,
        scopes: allNetworkCustomTokenScopesRef.current,
      });
      if (accounts.length === 0) {
        allNetworkEmptyAccountsResolvedRef.current = true;
      }
    },
    [applyCustomTokenProjection],
  );
  const handleAllNetworkFinished = useCallback(async () => {
    settleBalanceAuthority(
      allNetworkAuthorityTokenRef.current,
      resolveNativeHomeAllNetworkAuthorityStatus({
        emptyAccountsResolved: allNetworkEmptyAccountsResolvedRef.current,
        expectedRequestCount: allNetworkExpectedRequestCountRef.current,
        outcome: allNetworkRequestOutcomeRef.current,
        startedSucceeded: allNetworkStartedSucceededRef.current,
      }),
    );
    setIsRefreshing(false);
    setInitialized(true);
  }, [settleBalanceAuthority]);

  const {
    run: runAllNetwork,
    result: allNetworkResult,
    isEmptyAccount,
  } = useAllNetworkRequests<INativeHomeAllNetworkTokenResponse>({
    accountId,
    networkId,
    walletId,
    isAllNetworks,
    allNetworkRequests: fetchAllNetwork,
    allNetworkCacheRequests: readAllNetworkCache,
    allNetworkCacheData: applyAllNetworkCache,
    allNetworkAccountsData: handleAllNetworkAccountsData,
    clearAllNetworkData,
    disabled: !enabled,
    onRequestSettled: handleAllNetworkSettled,
    onStarted: handleAllNetworkStarted,
    onFinished: handleAllNetworkFinished,
  });

  useEffect(() => {
    if (allNetworkResult) {
      const authoritativeResponses =
        filterNativeHomeAllNetworkAuthoritativeResponses(allNetworkResult);
      if (authoritativeResponses.length === 0) {
        return;
      }
      allNetworkResponsesRef.current = new Map(
        authoritativeResponses.map((response, index) => [
          `${response.networkId ?? 'unknown'}:${response.accountId ?? index}`,
          response,
        ]),
      );
      applySlice(
        buildNativeHomeAllNetworkPortfolioProjection({
          responses: authoritativeResponses,
          aggregateTokenConfigMapRawData:
            aggregateTokenRawDataRef.current?.aggregateTokenConfigMap,
        }),
      );
    }
  }, [allNetworkResult, applySlice]);

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    allNetworkResponsesRef.current.clear();
    allNetworkCustomTokenScopesRef.current = [];
    setTokens([]);
    setMap({});
    setRiskTokens([]);
    setRiskMap({});
    setSmallBalanceTokens([]);
    setSmallBalanceMap({});
    setCustomTokens([]);
    setInitialized(false);
    setErrorCode(undefined);
    if (!enabled || !accountId || !networkId || !walletId || isAllNetworks) {
      return;
    }
    void (async () => {
      const requestId = requestIdRef.current;
      try {
        const cached =
          await backgroundApiProxy.serviceToken.getAccountLocalTokens({
            accountId,
            networkId,
          });
        if (requestIdRef.current === requestId && cached.hasCache) {
          applySlice({
            tokens: cached.tokenList,
            map: pickTokenMap(cached.tokenList, cached.tokenListMap),
            riskTokens: [],
            riskMap: {},
            smallBalanceTokens: [],
            smallBalanceMap: {},
          });
        }
      } catch {
        // The live request below remains authoritative when cache hydration fails.
      }
      await loadSingle();
    })();
  }, [
    accountId,
    applySlice,
    enabled,
    isAllNetworks,
    loadSingle,
    networkId,
    walletId,
  ]);

  useEffect(() => {
    if (enabled && isAllNetworks && isEmptyAccount) {
      setTokens([]);
      setMap({});
      setRiskTokens([]);
      setRiskMap({});
      setSmallBalanceTokens([]);
      setSmallBalanceMap({});
      setInitialized(true);
    }
  }, [enabled, isAllNetworks, isEmptyAccount]);

  const refresh = useCallback(async () => {
    if (isAllNetworks) {
      await runAllNetwork({
        alwaysSetState: true,
        skipAccountsCache: true,
      });
    } else {
      await loadSingle();
    }
  }, [isAllNetworks, loadSingle, runAllNetwork]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const reload = () => {
      void refresh();
    };
    const reloadAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      reload();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const timer = setInterval(reload, POLLING_INTERVAL_FOR_TOKEN);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [enabled, refresh]);

  return useMemo(
    () => ({
      balanceAuthority,
      customTokens,
      errorCode,
      initialized,
      isEmptyAccount,
      isRefreshing,
      map,
      riskMap,
      riskTokens,
      refresh,
      smallBalanceMap,
      smallBalanceTokens,
      tokens,
    }),
    [
      balanceAuthority,
      customTokens,
      errorCode,
      initialized,
      isEmptyAccount,
      isRefreshing,
      map,
      refresh,
      riskMap,
      riskTokens,
      smallBalanceMap,
      smallBalanceTokens,
      tokens,
    ],
  );
}
