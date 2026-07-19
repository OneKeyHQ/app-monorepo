import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_DEFI } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

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
  type INativeHomeBalanceAuthority,
  type INativeHomeBalanceAuthorityToken,
  buildNativeHomeBalanceScopeKey,
  useNativeHomeBalanceAuthorityOwner,
} from './nativeHomeBalanceAuthority';

type INativeHomeDeFiResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions>
>;

export interface INativeHomeDeFiData {
  balanceAuthority: INativeHomeBalanceAuthority;
  errorCode: string | undefined;
  initialized: boolean;
  isRefreshing: boolean;
  protocolMap: Record<string, IProtocolSummary>;
  protocols: IDeFiProtocol[];
  supportedActions: IDeFiSupportedProtocolAction[];
  refresh: () => Promise<void>;
}

const getProtocolKey = (protocol: IDeFiProtocol) =>
  defiUtils.buildProtocolMapKey({
    networkId: protocol.networkId,
    protocol: protocol.protocol,
  });

export function useNativeHomeDeFiData({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}): INativeHomeDeFiData {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [protocols, setProtocols] = useState<IDeFiProtocol[]>([]);
  const [protocolMap, setProtocolMap] = useState<
    Record<string, IProtocolSummary>
  >({});
  const [supportedActions, setSupportedActions] = useState<
    IDeFiSupportedProtocolAction[]
  >([]);
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
  const allNetworkGenerationRef = useRef(0);
  const allNetworkForceRefreshRef = useRef(false);
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  const networkId = network?.id;
  const walletId = wallet?.id;
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
  const sourceCurrencyInfo = currencyMap[settings.currencyInfo.id];
  const targetCurrencyInfo = currencyMap.usd;

  const applyResponse = useCallback((response: INativeHomeDeFiResponse) => {
    setProtocols((previous) => {
      const next = new Map(
        previous.map((item) => [getProtocolKey(item), item]),
      );
      response.protocols.forEach((item) =>
        next.set(getProtocolKey(item), item),
      );
      return Array.from(next.values());
    });
    setProtocolMap((previous) => ({ ...previous, ...response.protocolMap }));
    setInitialized(true);
  }, []);

  const loadSingle = useCallback(
    async (forceRefresh: boolean) => {
      if (!enabled || !accountId || !networkId || isAllNetworks) {
        return;
      }
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const authorityToken = beginBalanceAuthority();
      setIsRefreshing(true);
      setErrorCode(undefined);
      try {
        const response =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId,
            indexedAccountId,
            networkId,
            saveToLocal: true,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            isForceRefresh: forceRefresh,
          });
        if (requestIdRef.current === requestId) {
          setProtocols(response.protocols);
          setProtocolMap(response.protocolMap);
          setInitialized(true);
          settleBalanceAuthority(authorityToken, 'success');
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorCode('defi_fetch_failed');
          setInitialized(true);
          settleBalanceAuthority(authorityToken, 'error');
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsRefreshing(false);
        }
      }
    },
    [
      accountId,
      beginBalanceAuthority,
      enabled,
      indexedAccountId,
      isAllNetworks,
      networkId,
      sourceCurrencyInfo,
      settleBalanceAuthority,
      targetCurrencyInfo,
    ],
  );

  const fetchAllNetwork = useCallback(
    async ({
      accountId: childAccountId,
      networkId: childNetworkId,
      allNetworkDataInit,
    }: {
      accountId: string;
      networkId: string;
      allNetworkDataInit?: boolean;
    }) => {
      try {
        const response =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: childAccountId,
            indexedAccountId,
            networkId: childNetworkId,
            isAllNetworks: true,
            allNetworksAccountId: accountId,
            allNetworksNetworkId: networkId,
            saveToLocal: true,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            isForceRefresh:
              allNetworkForceRefreshRef.current || !allNetworkDataInit,
          });
        allNetworkRequestOutcomeRef.current =
          recordNativeHomeAllNetworkResponse(
            allNetworkRequestOutcomeRef.current,
            response,
          );
        return response;
      } catch (error) {
        allNetworkRequestOutcomeRef.current = recordNativeHomeAllNetworkFailure(
          allNetworkRequestOutcomeRef.current,
        );
        throw error;
      }
    },
    [
      accountId,
      indexedAccountId,
      networkId,
      sourceCurrencyInfo,
      targetCurrencyInfo,
    ],
  );

  const handleAllNetworkSettled = useCallback(
    (response: INativeHomeDeFiResponse, generation: number) => {
      if (response.isSameAllNetworksAccountData === false) {
        return;
      }
      if (generation < allNetworkGenerationRef.current) {
        return;
      }
      allNetworkGenerationRef.current = generation;
      applyResponse(response);
    },
    [applyResponse],
  );
  const clearAllNetworkData = useCallback(() => {
    setProtocols([]);
    setProtocolMap({});
  }, []);
  const handleAllNetworkStarted = useCallback(
    async ({
      accountId: ownerAccountId,
      networkId: ownerNetworkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      allNetworkAuthorityTokenRef.current = beginBalanceAuthority();
      allNetworkRequestOutcomeRef.current =
        createNativeHomeAllNetworkRequestOutcome();
      allNetworkExpectedRequestCountRef.current = 0;
      allNetworkEmptyAccountsResolvedRef.current = false;
      allNetworkStartedSucceededRef.current = false;
      setIsRefreshing(true);
      setErrorCode(undefined);
      if (ownerAccountId && ownerNetworkId) {
        await backgroundApiProxy.serviceDeFi.updateCurrentAccount({
          accountId: ownerAccountId,
          networkId: ownerNetworkId,
        });
      }
      allNetworkStartedSucceededRef.current = true;
    },
    [beginBalanceAuthority],
  );
  const handleAllNetworkAccountsData = useCallback(
    ({ accounts }: { accounts: IAllNetworkAccountInfo[] }) => {
      allNetworkExpectedRequestCountRef.current = accounts.length;
      if (accounts.length === 0) {
        allNetworkEmptyAccountsResolvedRef.current = true;
      }
    },
    [],
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
    allNetworkForceRefreshRef.current = false;
    setIsRefreshing(false);
    setInitialized(true);
  }, [settleBalanceAuthority]);

  const {
    run: runAllNetwork,
    result: allNetworkResult,
    isEmptyAccount,
  } = useAllNetworkRequests<INativeHomeDeFiResponse>({
    accountId,
    networkId,
    walletId,
    isAllNetworks,
    allNetworkRequests: fetchAllNetwork,
    allNetworkAccountsData: handleAllNetworkAccountsData,
    clearAllNetworkData,
    disabled: !enabled,
    isDeFiRequests: true,
    onRequestSettled: handleAllNetworkSettled,
    onStarted: handleAllNetworkStarted,
    onFinished: handleAllNetworkFinished,
  });

  useEffect(() => {
    if (!allNetworkResult) {
      return;
    }
    const authoritativeResponses =
      filterNativeHomeAllNetworkAuthoritativeResponses(allNetworkResult);
    if (authoritativeResponses.length === 0) {
      return;
    }
    const nextProtocols = new Map<string, IDeFiProtocol>();
    const nextProtocolMap: Record<string, IProtocolSummary> = {};
    authoritativeResponses.forEach((response) => {
      response.protocols.forEach((item) => {
        nextProtocols.set(getProtocolKey(item), item);
      });
      Object.assign(nextProtocolMap, response.protocolMap);
    });
    setProtocols(Array.from(nextProtocols.values()));
    setProtocolMap(nextProtocolMap);
    setInitialized(true);
  }, [allNetworkResult]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setSupportedActions([]);
      return () => {
        cancelled = true;
      };
    }
    void backgroundApiProxy.serviceDeFi
      .fetchSupportedDeFiProtocols()
      .then((result) => {
        if (!cancelled) {
          setSupportedActions(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSupportedActions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    setProtocols([]);
    setProtocolMap({});
    setInitialized(false);
    setErrorCode(undefined);
    if (!enabled || !accountId || !networkId || !walletId) {
      return;
    }
    if (!isAllNetworks) {
      void loadSingle(false);
    }
  }, [accountId, enabled, isAllNetworks, loadSingle, networkId, walletId]);

  useEffect(() => {
    if (enabled && isAllNetworks && isEmptyAccount) {
      setProtocols([]);
      setProtocolMap({});
      setInitialized(true);
    }
  }, [enabled, isAllNetworks, isEmptyAccount]);

  const refresh = useCallback(async () => {
    const { allowed } =
      await backgroundApiProxy.serviceDeFi.consumeManualDeFiForceRefreshQuota();
    if (isAllNetworks) {
      allNetworkForceRefreshRef.current = allowed;
      await runAllNetwork({
        alwaysSetState: true,
        skipAccountsCache: true,
      });
    } else {
      await loadSingle(allowed);
    }
  }, [isAllNetworks, loadSingle, runAllNetwork]);

  useEffect(() => {
    if (!enabled || !visible) {
      return;
    }
    const reload = () => {
      if (isAllNetworks) {
        void runAllNetwork({ alwaysSetState: true });
      } else {
        void loadSingle(false);
      }
    };
    const reloadAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      reload();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const timer = setInterval(reload, POLLING_INTERVAL_FOR_DEFI);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [enabled, isAllNetworks, loadSingle, runAllNetwork, visible]);

  return useMemo(
    () => ({
      balanceAuthority,
      errorCode,
      initialized,
      isRefreshing,
      protocolMap,
      protocols,
      supportedActions,
      refresh,
    }),
    [
      balanceAuthority,
      errorCode,
      initialized,
      isRefreshing,
      protocolMap,
      protocols,
      refresh,
      supportedActions,
    ],
  );
}
