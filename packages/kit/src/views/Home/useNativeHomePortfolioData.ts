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
  commitNativeHomeSnapshotBeforeProjection,
  projectNativeHomeCustomTokens,
} from './nativeHomeCustomTokenProjection';
import {
  type INativeHomePortfolioOwner,
  type INativeHomePortfolioRequestToken,
  advanceNativeHomePortfolioOwner,
  buildNativeHomePortfolioScopeKey,
  createNativeHomeSingleFlightRunner,
  isNativeHomePortfolioOwnerCurrent,
  isNativeHomePortfolioRequestCurrent,
} from './nativeHomePortfolioRequestLifecycle';

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
  dataScopeKey: string;
  errorCode: string | undefined;
  initialized: boolean;
  isEmptyAccount: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

type INativeHomeOwnedAllNetworkTokenResponse =
  INativeHomeAllNetworkTokenResponse & {
    nativeHomeGeneration?: number;
    nativeHomeOwnerEpoch: number;
    nativeHomeOwnerScopeKey: string;
  };

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
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const [customTokens, setCustomTokens] = useState<ICustomTokenItem[]>([]);
  const [dataScopeKey, setDataScopeKey] = useState('');
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
    new Map<string, INativeHomeOwnedAllNetworkTokenResponse>(),
  );
  const allNetworkCustomTokenScopesRef = useRef<INativeHomeCustomTokenScope[]>(
    [],
  );
  const accountId = account?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const indexedAccountId = indexedAccount?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const portfolioScopeKey = buildNativeHomePortfolioScopeKey({
    accountId,
    enabled,
    isAllNetworks,
    networkId,
    walletId,
  });
  const liveOwnerRef = useRef<INativeHomePortfolioOwner>({
    epoch: 0,
    scopeKey: '',
  });
  liveOwnerRef.current = advanceNativeHomePortfolioOwner(
    liveOwnerRef.current,
    portfolioScopeKey,
  );
  const renderOwner = liveOwnerRef.current;
  const isOwnerCurrent = useCallback(
    (owner: INativeHomePortfolioOwner) =>
      isNativeHomePortfolioOwnerCurrent({
        current: liveOwnerRef.current,
        expected: owner,
      }),
    [],
  );
  const singleFlightRunnerRef = useRef<
    ReturnType<typeof createNativeHomeSingleFlightRunner> | undefined
  >(undefined);
  if (!singleFlightRunnerRef.current) {
    singleFlightRunnerRef.current = createNativeHomeSingleFlightRunner({
      isOwnerCurrent,
    });
  }
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
      owner,
      rawData,
      scopes,
    }: {
      owner: INativeHomePortfolioOwner;
      rawData: Awaited<
        ReturnType<typeof backgroundApiProxy.simpleDb.customTokens.getRawData>
      >;
      scopes: INativeHomeCustomTokenScope[];
    }) => {
      if (!isOwnerCurrent(owner)) {
        return;
      }
      setCustomTokens(
        projectNativeHomeCustomTokens({
          rawData,
          scopes: [...scopes, aggregateCustomTokenScope],
        }),
      );
    },
    [aggregateCustomTokenScope, isOwnerCurrent],
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

  const applySlice = useCallback(
    (slice: INativeHomeTokenSlice, owner: INativeHomePortfolioOwner) => {
      if (!isOwnerCurrent(owner)) {
        return false;
      }
      setTokens(slice.tokens);
      setMap(slice.map);
      setRiskTokens(slice.riskTokens);
      setRiskMap(slice.riskMap);
      setSmallBalanceTokens(slice.smallBalanceTokens);
      setSmallBalanceMap(slice.smallBalanceMap);
      setDataScopeKey(owner.scopeKey);
      setInitialized(true);
      return true;
    },
    [isOwnerCurrent],
  );

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

  const loadSingleOnce = useCallback(async () => {
    const owner = renderOwner;
    if (
      !enabled ||
      !accountId ||
      !networkId ||
      isAllNetworks ||
      !isOwnerCurrent(owner)
    ) {
      return;
    }
    requestIdRef.current += 1;
    const request: INativeHomePortfolioRequestToken = {
      ...owner,
      generation: requestIdRef.current,
    };
    const isRequestCurrent = () =>
      isNativeHomePortfolioRequestCurrent({
        currentGeneration: requestIdRef.current,
        currentOwner: liveOwnerRef.current,
        request,
      });
    const authorityToken = beginBalanceAuthority();
    const customTokensTask = loadSingleCustomTokenProjection();
    if (isRequestCurrent()) {
      setIsRefreshing(true);
      setErrorCode(undefined);
    }
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
      commitNativeHomeSnapshotBeforeProjection({
        commitProjection: (projection) => {
          setCustomTokens(projection);
        },
        commitSnapshot: (snapshot) => {
          if (applySlice(snapshot, owner)) {
            settleBalanceAuthority(authorityToken, 'success');
          }
        },
        isCurrent: isRequestCurrent,
        projectionTask: customTokensTask,
        snapshot: slice,
      });
    } catch {
      if (isRequestCurrent()) {
        setErrorCode('portfolio_fetch_failed');
        setDataScopeKey(owner.scopeKey);
        setInitialized(true);
        settleBalanceAuthority(authorityToken, 'error');
      }
    } finally {
      if (isRequestCurrent()) {
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
    isOwnerCurrent,
    isAllNetworks,
    loadSingleCustomTokenProjection,
    mergeDerive,
    networkId,
    renderOwner,
    settleBalanceAuthority,
  ]);

  const loadSingle = useCallback(
    () =>
      singleFlightRunnerRef.current?.run(renderOwner, loadSingleOnce) ??
      Promise.resolve(),
    [loadSingleOnce, renderOwner],
  );

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
      const owner = renderOwner;
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
          nativeHomeOwnerEpoch: owner.epoch,
          nativeHomeOwnerScopeKey: owner.scopeKey,
        } satisfies INativeHomeOwnedAllNetworkTokenResponse;
        if (isOwnerCurrent(owner)) {
          allNetworkRequestOutcomeRef.current =
            recordNativeHomeAllNetworkResponse(
              allNetworkRequestOutcomeRef.current,
              normalizedResponse,
            );
        }
        return normalizedResponse;
      } catch (error) {
        if (isOwnerCurrent(owner)) {
          allNetworkRequestOutcomeRef.current =
            recordNativeHomeAllNetworkFailure(
              allNetworkRequestOutcomeRef.current,
            );
        }
        throw error;
      }
    },
    [accountId, indexedAccountId, isOwnerCurrent, networkId, renderOwner],
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
    async ({
      data: cached,
      generation,
    }: {
      data: INativeHomeNetworkTokenSlice[];
      generation: number;
    }) => {
      const request: INativeHomePortfolioRequestToken = {
        ...renderOwner,
        generation,
      };
      if (
        !isNativeHomePortfolioRequestCurrent({
          currentGeneration: allNetworkGenerationRef.current,
          currentOwner: liveOwnerRef.current,
          request,
        })
      ) {
        return;
      }
      if (cached.length > 0) {
        allNetworkGenerationRef.current = generation;
        const cachedResponses = cached.map((slice) => ({
          ...tokenSliceToResponse(slice),
          nativeHomeOwnerEpoch: renderOwner.epoch,
          nativeHomeOwnerScopeKey: renderOwner.scopeKey,
        }));
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
          renderOwner,
        );
      }
    },
    [applySlice, renderOwner],
  );

  const handleAllNetworkSettled = useCallback(
    (response: INativeHomeOwnedAllNetworkTokenResponse, generation: number) => {
      const request: INativeHomePortfolioRequestToken = {
        ...renderOwner,
        generation,
      };
      if (
        response.nativeHomeOwnerEpoch !== renderOwner.epoch ||
        response.nativeHomeOwnerScopeKey !== renderOwner.scopeKey ||
        !isNativeHomePortfolioRequestCurrent({
          currentGeneration: allNetworkGenerationRef.current,
          currentOwner: liveOwnerRef.current,
          request,
        })
      ) {
        return;
      }
      if (response.isSameAllNetworksAccountData === false) {
        return;
      }
      response.nativeHomeGeneration = generation;
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
        renderOwner,
      );
    },
    [applySlice, renderOwner],
  );
  const clearAllNetworkData = useCallback(() => {
    if (!isOwnerCurrent(renderOwner)) {
      return;
    }
    setTokens([]);
    setMap({});
    setRiskTokens([]);
    setRiskMap({});
    setSmallBalanceTokens([]);
    setSmallBalanceMap({});
    setDataScopeKey(renderOwner.scopeKey);
  }, [isOwnerCurrent, renderOwner]);
  const handleAllNetworkStarted = useCallback(
    async ({
      accountId: ownerAccountId,
      networkId: ownerNetworkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      const owner = renderOwner;
      if (!ownerAccountId || !ownerNetworkId || !isOwnerCurrent(owner)) {
        return;
      }
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
        backgroundApiProxy.serviceToken.updateCurrentAccount({
          accountId: ownerAccountId,
          networkId: ownerNetworkId,
        }),
      ]);
      if (!isOwnerCurrent(owner)) {
        return;
      }
      let aggregateTokenRawData = initialAggregateTokenRawData;
      if (!aggregateTokenRawData?.aggregateTokenConfigMap) {
        await backgroundApiProxy.serviceSetting.syncWalletConfig();
        aggregateTokenRawData =
          await backgroundApiProxy.simpleDb.aggregateToken.getRawData();
      }
      if (!isOwnerCurrent(owner)) {
        return;
      }
      customTokensRawDataRef.current = customTokensRawData;
      riskTokenManagementRawDataRef.current = riskTokenManagementRawData;
      aggregateTokenRawDataRef.current = aggregateTokenRawData;
      applyCustomTokenProjection({
        owner,
        rawData: customTokensRawData,
        scopes: allNetworkCustomTokenScopesRef.current,
      });
      allNetworkStartedSucceededRef.current = true;
    },
    [
      applyCustomTokenProjection,
      beginBalanceAuthority,
      isOwnerCurrent,
      renderOwner,
    ],
  );
  const handleAllNetworkAccountsData = useCallback(
    ({ accounts }: { accounts: IAllNetworkAccountInfo[] }) => {
      if (!isOwnerCurrent(renderOwner)) {
        return;
      }
      allNetworkExpectedRequestCountRef.current = accounts.length;
      allNetworkCustomTokenScopesRef.current = accounts.map((item) => ({
        accountXpubOrAddress: item.accountXpub ?? item.apiAddress.toLowerCase(),
        networkId: item.networkId,
      }));
      applyCustomTokenProjection({
        owner: renderOwner,
        rawData: customTokensRawDataRef.current,
        scopes: allNetworkCustomTokenScopesRef.current,
      });
      setIsEmptyAccount(accounts.length === 0);
      if (accounts.length === 0) {
        allNetworkEmptyAccountsResolvedRef.current = true;
        setTokens([]);
        setMap({});
        setRiskTokens([]);
        setRiskMap({});
        setSmallBalanceTokens([]);
        setSmallBalanceMap({});
        setDataScopeKey(renderOwner.scopeKey);
      }
    },
    [applyCustomTokenProjection, isOwnerCurrent, renderOwner],
  );
  const handleAllNetworkFinished = useCallback(async () => {
    if (!isOwnerCurrent(renderOwner)) {
      return;
    }
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
    setDataScopeKey(renderOwner.scopeKey);
    setInitialized(true);
  }, [isOwnerCurrent, renderOwner, settleBalanceAuthority]);

  const { run: runAllNetwork, result: allNetworkResult } =
    useAllNetworkRequests<INativeHomeOwnedAllNetworkTokenResponse>({
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
    const owner = renderOwner;
    if (allNetworkResult && isOwnerCurrent(owner)) {
      const authoritativeResponses =
        filterNativeHomeAllNetworkAuthoritativeResponses(
          allNetworkResult.filter(
            (response) =>
              response.nativeHomeOwnerEpoch === owner.epoch &&
              response.nativeHomeOwnerScopeKey === owner.scopeKey &&
              response.nativeHomeGeneration !== undefined &&
              response.nativeHomeGeneration >= allNetworkGenerationRef.current,
          ),
        );
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
        owner,
      );
    }
  }, [allNetworkResult, applySlice, isOwnerCurrent, renderOwner]);

  useEffect(() => {
    const owner = renderOwner;
    if (!isOwnerCurrent(owner)) {
      return;
    }
    requestIdRef.current += 1;
    allNetworkResponsesRef.current.clear();
    allNetworkCustomTokenScopesRef.current = [];
    setTokens([]);
    setMap({});
    setRiskTokens([]);
    setRiskMap({});
    setSmallBalanceTokens([]);
    setSmallBalanceMap({});
    setCustomTokens([]);
    setDataScopeKey(owner.scopeKey);
    setIsEmptyAccount(false);
    setInitialized(false);
    setIsRefreshing(false);
    setErrorCode(undefined);
    if (!enabled || !accountId || !networkId || !walletId) {
      setInitialized(true);
      return;
    }
    if (isAllNetworks) {
      return;
    }
    const hydrationGeneration = requestIdRef.current;
    void (async () => {
      try {
        const cached =
          await backgroundApiProxy.serviceToken.getAccountLocalTokens({
            accountId,
            networkId,
          });
        if (
          isOwnerCurrent(owner) &&
          requestIdRef.current === hydrationGeneration &&
          cached.hasCache
        ) {
          applySlice(
            {
              tokens: cached.tokenList,
              map: pickTokenMap(cached.tokenList, cached.tokenListMap),
              riskTokens: [],
              riskMap: {},
              smallBalanceTokens: [],
              smallBalanceMap: {},
            },
            owner,
          );
        }
      } catch {
        // The live request below remains authoritative when cache hydration fails.
      }
      if (isOwnerCurrent(owner)) {
        await loadSingle();
      }
    })();
  }, [
    accountId,
    applySlice,
    enabled,
    isAllNetworks,
    isOwnerCurrent,
    loadSingle,
    networkId,
    renderOwner,
    walletId,
  ]);

  useEffect(() => {
    const owner = renderOwner;
    if (!enabled || !accountId || !networkId || !isOwnerCurrent(owner)) {
      return;
    }
    void backgroundApiProxy.serviceToken
      .updateCurrentAccount({
        accountId,
        networkId,
      })
      .catch(() => undefined);
  }, [accountId, enabled, isOwnerCurrent, networkId, renderOwner]);

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
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      return refresh();
    };
    const reloadAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      void reload();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const schedulePoll = () => {
      timer = setTimeout(() => {
        void reload().finally(() => {
          if (!cancelled) {
            schedulePoll();
          }
        });
      }, POLLING_INTERVAL_FOR_TOKEN);
    };
    schedulePoll();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [enabled, refresh]);

  return useMemo(
    () => ({
      balanceAuthority,
      customTokens,
      dataScopeKey,
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
      dataScopeKey,
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
