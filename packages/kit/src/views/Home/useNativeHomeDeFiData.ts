import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHomeActions } from '@onekeyhq/kit/src/states/jotai/contexts/home';
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
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { useAllNetworkRequests } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import {
  useHomeFactsShadow,
  useHomeSectionSemantic,
} from './model/react/homeSemanticHooks';
import {
  buildHomeDeFiCoverage,
  projectHomeDeFiSectionSource,
} from './model/sections/defi/homeDeFiSectionPolicy';
import {
  adaptHomeDeFiSourceSnapshot,
  createHomeDeFiSourceIdentity,
  getHomeDeFiProtocolRowIds,
} from './model/sections/defi/homeDeFiSourceAdapter';
import { HomeSectionCoordinator } from './model/sections/homeSectionCoordinator';
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

import type { IHomeDeFiEvidence } from './model/sections/defi/homeDeFiSectionPolicy';
import type {
  IHomeDeFiLegacyPayload,
  IHomeDeFiSourceParams,
} from './model/sections/defi/homeDeFiSourceAdapter';
import type { IHomeSectionCoordinatorResolution } from './model/sections/homeSectionCoordinator';

type INativeHomeDeFiResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions>
>;

let nativeHomeDeFiProducerInstance = 0;

function createNativeHomeDeFiProducerInstanceId() {
  nativeHomeDeFiProducerInstance += 1;
  return `native-home-defi:${nativeHomeDeFiProducerInstance}`;
}

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

const getAllNetworkResponseKey = (
  response: INativeHomeDeFiResponse,
  fallbackIndex: number,
) => {
  const rowIds = getHomeDeFiProtocolRowIds({
    protocolMap: response.protocolMap,
    protocols: response.protocols,
    supportedActions: [],
  });
  return rowIds.length
    ? stringUtils.stableStringify(rowIds)
    : `empty:${fallbackIndex}`;
};

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
  const allNetworkSourceIdentityKeyRef = useRef<string | undefined>(undefined);
  const allNetworkResponsesRef = useRef(
    new Map<string, INativeHomeDeFiResponse>(),
  );
  const sourceCurrencyInfo = currencyMap[settings.currencyInfo.id];
  const targetCurrencyInfo = currencyMap.usd;
  const homeFactsShadow = useHomeFactsShadow();
  const homeDeFiSemantic = useHomeSectionSemantic('defi');
  const { clearSemanticSection, publishSemanticSection } =
    useHomeActions().current;
  const [deFiProducerInstanceId] = useState(
    createNativeHomeDeFiProducerInstanceId,
  );
  const deFiSourceIdentity = useMemo(() => {
    const ownerMatches =
      homeFactsShadow?.owner.walletId === walletId &&
      homeFactsShadow?.owner.accountId === accountId &&
      (isAllNetworks
        ? homeFactsShadow?.owner.network.kind === 'allNetworks'
        : homeFactsShadow?.owner.network.kind === 'singleNetwork' &&
          homeFactsShadow.owner.network.networkId === networkId);
    if (
      !enabled ||
      !ownerMatches ||
      !homeFactsShadow ||
      !accountId ||
      !networkId ||
      !walletId
    ) {
      return undefined;
    }
    const params: IHomeDeFiSourceParams = {
      accountId,
      indexedAccountId,
      networkId,
      walletId,
      networkMode: isAllNetworks ? 'allNetworks' : 'singleNetwork',
      sourceCurrencyId: sourceCurrencyInfo?.id,
      targetCurrencyId: targetCurrencyInfo?.id,
    };
    return createHomeDeFiSourceIdentity({
      owner: homeFactsShadow.ownerToken,
      params,
      producerInstanceId: deFiProducerInstanceId,
    });
  }, [
    accountId,
    deFiProducerInstanceId,
    enabled,
    homeFactsShadow,
    indexedAccountId,
    isAllNetworks,
    networkId,
    sourceCurrencyInfo?.id,
    targetCurrencyInfo?.id,
    walletId,
  ]);
  const deFiSourceIdentityKey = useMemo(
    () =>
      deFiSourceIdentity
        ? stringUtils.stableStringify(deFiSourceIdentity)
        : undefined,
    [deFiSourceIdentity],
  );
  const deFiCoordinatorRef = useRef<
    HomeSectionCoordinator<IHomeDeFiLegacyPayload> | undefined
  >(undefined);
  const deFiSemanticRevisionRef = useRef(0);
  const allNetworkSectionRequestSeqRef = useRef(0);

  useLayoutEffect(() => {
    deFiSemanticRevisionRef.current = Math.max(
      deFiSemanticRevisionRef.current,
      homeDeFiSemantic?.revision ?? 0,
    );
  }, [homeDeFiSemantic?.revision]);

  const applyAuthoritativeDeFiPayload = useCallback(
    (resolution: IHomeSectionCoordinatorResolution<IHomeDeFiLegacyPayload>) => {
      if (resolution.authoritative.kind === 'none') {
        return;
      }
      setProtocols(resolution.authoritative.data.protocols);
      setProtocolMap(resolution.authoritative.data.protocolMap);
      setInitialized(true);
    },
    [],
  );

  const publishDeFiEvidence = useCallback(
    ({
      evidence,
      requestSeq,
    }: {
      evidence: IHomeDeFiEvidence;
      requestSeq: number;
    }) => {
      if (!deFiSourceIdentity || !deFiSourceIdentityKey) {
        return undefined;
      }
      let coordinator = deFiCoordinatorRef.current;
      if (!coordinator) {
        coordinator = new HomeSectionCoordinator<IHomeDeFiLegacyPayload>(
          deFiSourceIdentity,
        );
        deFiCoordinatorRef.current = coordinator;
      } else {
        coordinator.setOwner(deFiSourceIdentity);
      }
      const resolution = coordinator.dispatch(
        adaptHomeDeFiSourceSnapshot({
          identity: deFiSourceIdentity,
          snapshot: projectHomeDeFiSectionSource({
            authorityReady: true,
            evidence,
            requestSeq,
            scopeMatches: Boolean(balanceScopeKey),
          }),
        }),
      );
      if (!resolution.accepted) {
        return resolution;
      }
      deFiSemanticRevisionRef.current += 1;
      publishSemanticSection({
        owner: deFiSourceIdentity.owner,
        revision: deFiSemanticRevisionRef.current,
        sectionId: 'defi',
        value: resolution.semantic,
      });
      applyAuthoritativeDeFiPayload(resolution);
      return resolution;
    },
    [
      applyAuthoritativeDeFiPayload,
      balanceScopeKey,
      deFiSourceIdentity,
      deFiSourceIdentityKey,
      publishSemanticSection,
    ],
  );

  const buildDeFiPayload = useCallback(
    ({
      nextProtocolMap,
      nextProtocols,
    }: {
      nextProtocolMap: Record<string, IProtocolSummary>;
      nextProtocols: IDeFiProtocol[];
    }): IHomeDeFiLegacyPayload => ({
      protocolMap: nextProtocolMap,
      protocols: nextProtocols,
      supportedActions,
    }),
    [supportedActions],
  );

  const buildAllNetworkPayload = useCallback((): IHomeDeFiLegacyPayload => {
    const nextProtocols = new Map<string, IDeFiProtocol>();
    const nextProtocolMap: Record<string, IProtocolSummary> = {};
    Array.from(allNetworkResponsesRef.current.values()).forEach((response) => {
      response.protocols.forEach((item) => {
        nextProtocols.set(getProtocolKey(item), item);
      });
      Object.assign(nextProtocolMap, response.protocolMap);
    });
    return buildDeFiPayload({
      nextProtocolMap,
      nextProtocols: Array.from(nextProtocols.values()),
    });
  }, [buildDeFiPayload]);

  const isAllNetworkSourceCurrent = useCallback(
    () =>
      Boolean(deFiSourceIdentityKey) &&
      allNetworkSourceIdentityKeyRef.current === deFiSourceIdentityKey,
    [deFiSourceIdentityKey],
  );

  useEffect(() => {
    if (deFiSourceIdentity && deFiSourceIdentityKey) {
      return;
    }
    deFiCoordinatorRef.current = undefined;
    if (homeFactsShadow) {
      deFiSemanticRevisionRef.current += 1;
      clearSemanticSection({
        owner: homeFactsShadow.ownerToken,
        revision: deFiSemanticRevisionRef.current,
        sectionId: 'defi',
      });
    }
  }, [
    clearSemanticSection,
    deFiSourceIdentity,
    deFiSourceIdentityKey,
    homeFactsShadow,
  ]);

  useEffect(
    () => () => {
      deFiCoordinatorRef.current?.dispose();
    },
    [],
  );

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
      publishDeFiEvidence({
        requestSeq: requestId,
        evidence: { kind: 'loading' },
      });
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
          const payload = buildDeFiPayload({
            nextProtocolMap: response.protocolMap,
            nextProtocols: response.protocols,
          });
          const rowIds = getHomeDeFiProtocolRowIds(payload);
          publishDeFiEvidence({
            requestSeq: requestId,
            evidence: {
              kind: 'complete',
              confirmedEmpty: response.protocols.length === 0,
              coverageFingerprint: buildHomeDeFiCoverage({
                requestSeq: requestId,
                rowCount: rowIds.length,
                source: 'singleNetwork',
              }),
              data: payload,
              rowIds,
            },
          });
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorCode('defi_fetch_failed');
          setInitialized(true);
          settleBalanceAuthority(authorityToken, 'error');
          publishDeFiEvidence({
            requestSeq: requestId,
            evidence: { kind: 'error', errorKind: 'source' },
          });
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
      buildDeFiPayload,
      enabled,
      indexedAccountId,
      isAllNetworks,
      networkId,
      publishDeFiEvidence,
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
      if (!isAllNetworkSourceCurrent()) {
        return;
      }
      allNetworkGenerationRef.current = generation;
      allNetworkResponsesRef.current.set(
        getAllNetworkResponseKey(response, allNetworkResponsesRef.current.size),
        response,
      );
      applyResponse(response);
      const payload = buildAllNetworkPayload();
      publishDeFiEvidence({
        requestSeq: allNetworkSectionRequestSeqRef.current,
        evidence: {
          kind: 'partial',
          coverageFingerprint: `defi:allNetworks:${
            allNetworkSectionRequestSeqRef.current
          }:settled:${
            allNetworkRequestOutcomeRef.current.attemptCount
          }:expected:${
            allNetworkExpectedRequestCountRef.current
          }:rows:${getHomeDeFiProtocolRowIds(payload).length}:partial`,
        },
      });
    },
    [
      applyResponse,
      buildAllNetworkPayload,
      isAllNetworkSourceCurrent,
      publishDeFiEvidence,
    ],
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
      allNetworkSourceIdentityKeyRef.current = deFiSourceIdentityKey;
      allNetworkResponsesRef.current.clear();
      allNetworkSectionRequestSeqRef.current += 1;
      const requestSeq = allNetworkSectionRequestSeqRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      publishDeFiEvidence({
        requestSeq,
        evidence: { kind: 'loading' },
      });
      if (ownerAccountId && ownerNetworkId) {
        await backgroundApiProxy.serviceDeFi.updateCurrentAccount({
          accountId: ownerAccountId,
          networkId: ownerNetworkId,
        });
      }
      allNetworkStartedSucceededRef.current = true;
    },
    [beginBalanceAuthority, deFiSourceIdentityKey, publishDeFiEvidence],
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
    if (!isAllNetworkSourceCurrent()) {
      return;
    }
    const expectedRequestCount = allNetworkExpectedRequestCountRef.current;
    const outcome = allNetworkRequestOutcomeRef.current;
    const requestSeq = allNetworkSectionRequestSeqRef.current;
    const authorityStatus = resolveNativeHomeAllNetworkAuthorityStatus({
      emptyAccountsResolved: allNetworkEmptyAccountsResolvedRef.current,
      expectedRequestCount,
      outcome,
      startedSucceeded: allNetworkStartedSucceededRef.current,
    });
    settleBalanceAuthority(
      allNetworkAuthorityTokenRef.current,
      authorityStatus,
    );
    const payload = buildAllNetworkPayload();
    const rowIds = getHomeDeFiProtocolRowIds(payload);
    if (allNetworkEmptyAccountsResolvedRef.current) {
      publishDeFiEvidence({
        requestSeq,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq,
            rowCount: 0,
            source: 'allNetworks',
          }),
          data: undefined,
          rowIds: [],
        },
      });
    } else if (authorityStatus === 'error') {
      publishDeFiEvidence({
        requestSeq,
        evidence: { kind: 'error', errorKind: 'source' },
      });
    } else {
      publishDeFiEvidence({
        requestSeq,
        evidence: {
          kind: 'complete',
          confirmedEmpty: rowIds.length === 0,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq,
            rowCount: rowIds.length,
            source: 'allNetworks',
          }),
          data: payload,
          rowIds,
        },
      });
    }
    allNetworkForceRefreshRef.current = false;
    setIsRefreshing(false);
    setInitialized(true);
  }, [
    buildAllNetworkPayload,
    isAllNetworkSourceCurrent,
    publishDeFiEvidence,
    settleBalanceAuthority,
  ]);

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
