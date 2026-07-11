import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
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
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { useAllNetworkRequests } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

interface INativeHomeTokenSlice {
  map: Record<string, ITokenFiat>;
  riskMap: Record<string, ITokenFiat>;
  riskTokens: IAccountToken[];
  smallBalanceMap: Record<string, ITokenFiat>;
  smallBalanceTokens: IAccountToken[];
  tokens: IAccountToken[];
}

interface INativeHomeNetworkTokenSlice extends INativeHomeTokenSlice {
  networkId: string;
}

export interface INativeHomePortfolioData extends INativeHomeTokenSlice {
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

function mergeTokenSlices(
  slices: INativeHomeTokenSlice[],
): INativeHomeTokenSlice {
  const mergeCategory = (
    tokenKey: 'riskTokens' | 'smallBalanceTokens' | 'tokens',
    mapKey: 'map' | 'riskMap' | 'smallBalanceMap',
  ) => {
    const tokens = new Map<string, IAccountToken>();
    const map: Record<string, ITokenFiat> = {};
    slices.forEach((slice) => {
      slice[tokenKey].forEach((token) => tokens.set(token.$key, token));
      Object.assign(map, slice[mapKey]);
    });
    return {
      map,
      tokens: Array.from(tokens.values()).toSorted((left, right) =>
        new BigNumber(map[right.$key]?.fiatValue ?? 0).comparedTo(
          new BigNumber(map[left.$key]?.fiatValue ?? 0),
        ),
      ),
    };
  };
  const regular = mergeCategory('tokens', 'map');
  const risk = mergeCategory('riskTokens', 'riskMap');
  const smallBalance = mergeCategory('smallBalanceTokens', 'smallBalanceMap');
  return {
    map: regular.map,
    tokens: regular.tokens,
    riskMap: risk.map,
    riskTokens: risk.tokens,
    smallBalanceMap: smallBalance.map,
    smallBalanceTokens: smallBalance.tokens,
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
  const allNetworkSlicesRef = useRef(
    new Map<string, INativeHomeNetworkTokenSlice>(),
  );
  const accountId = account?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const indexedAccountId = indexedAccount?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const mergeDerive =
    Boolean(vaultSettings?.mergeDeriveAssetsEnabled) &&
    !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
    deriveInfoItems.length > 1;

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
      if (requestIdRef.current === requestId) {
        applySlice(slice);
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setErrorCode('portfolio_fetch_failed');
        setInitialized(true);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsRefreshing(false);
      }
    }
  }, [
    accountId,
    applySlice,
    enabled,
    fetchSingleNetwork,
    indexedAccountId,
    isAllNetworks,
    mergeDerive,
    networkId,
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
    }) =>
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
      const cached =
        await backgroundApiProxy.serviceToken.getAccountLocalTokens({
          accountId: childAccountId,
          networkId: childNetworkId,
          accountAddress,
          xpub,
        });
      if (!cached.hasCache) {
        return undefined;
      }
      return {
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
        allNetworkSlicesRef.current = new Map(
          cached.map((slice) => [slice.networkId, slice]),
        );
        applySlice(mergeTokenSlices(cached));
      }
    },
    [applySlice],
  );

  const handleAllNetworkSettled = useCallback(
    (response: IFetchAccountTokensResp, generation: number) => {
      if (response.isSameAllNetworksAccountData === false) {
        return;
      }
      if (generation < allNetworkGenerationRef.current) {
        return;
      }
      allNetworkGenerationRef.current = generation;
      const slice = getResponseSlice(response);
      const responseNetworkId =
        response.networkId ?? slice.tokens[0]?.networkId ?? '';
      if (!responseNetworkId) {
        return;
      }
      allNetworkSlicesRef.current.set(responseNetworkId, {
        ...slice,
        networkId: responseNetworkId,
      });
      applySlice(
        mergeTokenSlices(Array.from(allNetworkSlicesRef.current.values())),
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
    setIsRefreshing(true);
    setErrorCode(undefined);
    const [customTokensRawData, riskTokenManagementRawData] = await Promise.all(
      [
        backgroundApiProxy.simpleDb.customTokens.getRawData(),
        backgroundApiProxy.simpleDb.riskTokenManagement.getRawData(),
        accountId && networkId
          ? backgroundApiProxy.serviceToken.updateCurrentAccount({
              accountId,
              networkId,
            })
          : Promise.resolve(),
      ],
    );
    customTokensRawDataRef.current = customTokensRawData;
    riskTokenManagementRawDataRef.current = riskTokenManagementRawData;
  }, [accountId, networkId]);
  const handleAllNetworkFinished = useCallback(async () => {
    setIsRefreshing(false);
    setInitialized(true);
  }, []);

  const {
    run: runAllNetwork,
    result: allNetworkResult,
    isEmptyAccount,
  } = useAllNetworkRequests<IFetchAccountTokensResp>({
    accountId,
    networkId,
    walletId,
    isAllNetworks,
    allNetworkRequests: fetchAllNetwork,
    allNetworkCacheRequests: readAllNetworkCache,
    allNetworkCacheData: applyAllNetworkCache,
    clearAllNetworkData,
    disabled: !enabled,
    onRequestSettled: handleAllNetworkSettled,
    onStarted: handleAllNetworkStarted,
    onFinished: handleAllNetworkFinished,
  });

  useEffect(() => {
    if (allNetworkResult) {
      allNetworkSlicesRef.current = new Map(
        allNetworkResult.map((response, index) => {
          const slice = getResponseSlice(response);
          const responseNetworkId =
            response.networkId ??
            slice.tokens[0]?.networkId ??
            `unknown:${index}`;
          return [
            responseNetworkId,
            { ...slice, networkId: responseNetworkId },
          ];
        }),
      );
      applySlice(mergeTokenSlices(allNetworkResult.map(getResponseSlice)));
    }
  }, [allNetworkResult, applySlice]);

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    allNetworkSlicesRef.current.clear();
    setTokens([]);
    setMap({});
    setRiskTokens([]);
    setRiskMap({});
    setSmallBalanceTokens([]);
    setSmallBalanceMap({});
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
