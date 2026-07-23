import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDeFiDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_DEFI } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IAppEventBusPayload,
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

import {
  createNativeHomeAllNetworkRequestOutcome,
  recordNativeHomeAllNetworkFailure,
  recordNativeHomeAllNetworkResponse,
  resolveNativeHomeAllNetworkAuthorityStatus,
} from '../../nativeHomeAllNetworkAuthority';
import {
  type IHomeDeFiEvidence,
  buildHomeDeFiCoverage,
  projectHomeDeFiSectionSource,
} from '../sections/defi/homeDeFiSectionPolicy';
import {
  HOME_DEFI_DATA_SCHEMA_VERSION,
  type IHomeDeFiLegacyPayload,
  type IHomeDeFiSourceParams,
  adaptHomeDeFiSourceSnapshot,
  createHomeDeFiSourceIdentity,
  getHomeDeFiProtocolRowIds,
} from '../sections/defi/homeDeFiSourceAdapter';
import {
  HomeSectionCoordinator,
  type IHomeSectionCoordinatorResolution,
} from '../sections/homeSectionCoordinator';
import {
  createHomeStoreSectionSourceResult,
  normalizeHomeStoreJson,
} from '../store/homeStoreJson';

import { subscribeHomeDeFiSourceCommand } from './homeDeFiIntents';
import { useStableHomeFactsOwner } from './homeStoreHooks';
import {
  type IHomeSectionSourceRequestHandle,
  useHomeStoreSourcePublisher,
} from './useHomeStoreSourcePublisher';

type INativeHomeDeFiResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions>
>;

let nativeHomeDeFiProducerInstance = 0;

function createNativeHomeDeFiProducerInstanceId() {
  nativeHomeDeFiProducerInstance += 1;
  return `native-home-defi:${nativeHomeDeFiProducerInstance}`;
}

export interface IHomeDeFiStoreSource {
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

function convertDeFiOverviewValues(
  overview: {
    totalValue: number;
    totalDebt: number;
    totalReward: number;
    netWorth: number;
  },
  sourceCurrencyValue: string,
  targetCurrencyValue: string,
) {
  const convert = (value: number) =>
    new BigNumber(value)
      .div(sourceCurrencyValue)
      .times(targetCurrencyValue)
      .toNumber();
  return {
    totalValue: convert(overview.totalValue),
    totalDebt: convert(overview.totalDebt),
    totalReward: convert(overview.totalReward),
    netWorth: convert(overview.netWorth),
  };
}

const getAllNetworkResponseKey = (
  response: INativeHomeDeFiResponse,
  fallbackIndex: number,
) => {
  const rowIds = getHomeDeFiProtocolRowIds({
    protocols: response.protocols,
  });
  return rowIds.length
    ? stringUtils.stableStringify(rowIds)
    : `empty:${fallbackIndex}`;
};

export function useHomeDeFiStoreSource({
  enabled,
  refreshCacheOnly,
  visible,
}: {
  enabled: boolean;
  refreshCacheOnly: boolean;
  visible: boolean;
}): IHomeDeFiStoreSource {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAccountDeFiOverview, updateOverviewDeFiDataState } =
    useAccountOverviewActions().current;
  const [protocols, setProtocols] = useState<IDeFiProtocol[]>([]);
  const [protocolMap, setProtocolMap] = useState<
    Record<string, IProtocolSummary>
  >({});
  const protocolsRef = useRef<IDeFiProtocol[]>([]);
  const protocolMapRef = useRef<Record<string, IProtocolSummary>>({});
  const [supportedActions, setSupportedActions] = useState<
    IDeFiSupportedProtocolAction[]
  >([]);
  const supportedActionsRef = useRef<IDeFiSupportedProtocolAction[]>([]);
  const supportedActionsLoadedRef = useRef(false);
  const supportedActionsPromiseRef = useRef<
    Promise<IDeFiSupportedProtocolAction[]> | undefined
  >(undefined);
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  protocolsRef.current = protocols;
  protocolMapRef.current = protocolMap;
  const requestIdRef = useRef(0);
  const sourceRequestSeqRef = useRef(0);
  const renderedOwnerScopeRef = useRef<string | undefined>(undefined);
  const allNetworkGenerationRef = useRef(0);
  const allNetworkForceRefreshRef = useRef(false);
  const allNetworkConsumeForceRefreshQuotaRef = useRef(false);
  const singleNetworkLoadRef = useRef<
    | {
        identityKey: string;
        promise: Promise<void>;
      }
    | undefined
  >(undefined);
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const fullSourceEnabled = enabled && !refreshCacheOnly;
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
  const deFiRawDataRef = useRef<IDeFiDBStruct | undefined>(undefined);
  const sourceCurrencyInfo = currencyMap[settings.currencyInfo.id];
  const targetCurrencyInfo = currencyMap.usd;
  const homeFactsOwner = useStableHomeFactsOwner();
  const { beginHomeSectionRequest, completeHomeSectionRequest } =
    useHomeStoreSourcePublisher();
  const [deFiProducerInstanceId] = useState(
    createNativeHomeDeFiProducerInstanceId,
  );
  const updateOverview = useCallback(
    ({
      overview,
      ownerAccountId = accountId,
      ownerNetworkId = networkId,
    }: {
      overview: {
        totalValue?: number;
        totalDebt?: number;
        totalReward?: number;
        netWorth?: number;
      };
      ownerAccountId?: string;
      ownerNetworkId?: string;
    }) => {
      if (!ownerAccountId || !ownerNetworkId) {
        return;
      }
      updateAccountDeFiOverview({
        accountId: ownerAccountId,
        currency: settings.currencyInfo.id,
        isReady: true,
        networkId: ownerNetworkId,
        overview: {
          totalDebt: overview.totalDebt ?? 0,
          totalReward: overview.totalReward ?? 0,
          totalValue: overview.totalValue ?? 0,
          netWorth: overview.netWorth ?? 0,
        },
      });
    },
    [accountId, networkId, settings.currencyInfo.id, updateAccountDeFiOverview],
  );
  const deFiSourceIdentity = useMemo(() => {
    const ownerMatches =
      homeFactsOwner?.owner.walletId === walletId &&
      homeFactsOwner?.owner.accountId === accountId &&
      (isAllNetworks
        ? homeFactsOwner?.owner.network.kind === 'allNetworks'
        : homeFactsOwner?.owner.network.kind === 'singleNetwork' &&
          homeFactsOwner.owner.network.networkId === networkId);
    if (
      !fullSourceEnabled ||
      !ownerMatches ||
      !homeFactsOwner ||
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
      owner: homeFactsOwner.ownerToken,
      params,
      producerInstanceId: deFiProducerInstanceId,
    });
  }, [
    accountId,
    deFiProducerInstanceId,
    fullSourceEnabled,
    homeFactsOwner,
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
  const allNetworkSectionRequestSeqRef = useRef(0);
  const requestHandleBySeqRef = useRef(
    new Map<number, IHomeSectionSourceRequestHandle>(),
  );

  useEffect(() => {
    const requestHandles = requestHandleBySeqRef.current;
    requestHandles.clear();
    return () => {
      requestHandles.clear();
    };
  }, [deFiSourceIdentityKey]);

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
            scopeMatches: Boolean(deFiSourceIdentity),
          }),
        }),
      );
      if (!resolution.accepted) {
        return resolution;
      }
      if (evidence.kind === 'loading') {
        const handle = beginHomeSectionRequest({
          dataSchemaVersion: HOME_DEFI_DATA_SCHEMA_VERSION,
          ownerToken: deFiSourceIdentity.owner,
          paramsFingerprint: deFiSourceIdentity.sourceKeyIdentity,
          quoteBasis: { currency: settings.currencyInfo.id },
          sectionId: 'defi',
        });
        requestHandleBySeqRef.current.set(requestSeq, handle);
        return resolution;
      }
      if (evidence.kind === 'partial') {
        const handle = requestHandleBySeqRef.current.get(requestSeq);
        const data = normalizeHomeStoreJson(evidence.data);
        if (handle && data !== undefined) {
          completeHomeSectionRequest(handle, {
            kind: 'partial',
            coverageFingerprint: evidence.coverageFingerprint,
            data,
          });
        }
        applyAuthoritativeDeFiPayload(resolution);
        return resolution;
      }
      const handle = requestHandleBySeqRef.current.get(requestSeq);
      if (!handle) {
        return resolution;
      }
      const data =
        resolution.authoritative.kind === 'none'
          ? undefined
          : normalizeHomeStoreJson(resolution.authoritative.data);
      completeHomeSectionRequest(
        handle,
        createHomeStoreSectionSourceResult(resolution.semantic, data),
      );
      requestHandleBySeqRef.current.delete(requestSeq);
      applyAuthoritativeDeFiPayload(resolution);
      return resolution;
    },
    [
      applyAuthoritativeDeFiPayload,
      beginHomeSectionRequest,
      completeHomeSectionRequest,
      deFiSourceIdentity,
      deFiSourceIdentityKey,
      settings.currencyInfo.id,
    ],
  );

  const loadSupportedActions = useCallback(async () => {
    if (supportedActionsLoadedRef.current) {
      return supportedActionsRef.current;
    }
    if (!supportedActionsPromiseRef.current) {
      supportedActionsPromiseRef.current = backgroundApiProxy.serviceDeFi
        .fetchSupportedDeFiProtocols()
        .catch(() => []);
    }
    const nextSupportedActions = await supportedActionsPromiseRef.current;
    supportedActionsPromiseRef.current = undefined;
    supportedActionsLoadedRef.current = true;
    supportedActionsRef.current = nextSupportedActions;
    setSupportedActions(nextSupportedActions);
    return nextSupportedActions;
  }, []);

  const buildDeFiPayload = useCallback(
    ({
      nextProtocolMap,
      nextProtocols,
      nextSupportedActions = supportedActionsRef.current,
      overview,
    }: {
      nextProtocolMap: Record<string, IProtocolSummary>;
      nextProtocols: IDeFiProtocol[];
      nextSupportedActions?: IDeFiSupportedProtocolAction[];
      overview: IHomeDeFiLegacyPayload['overview'];
    }): IHomeDeFiLegacyPayload => ({
      currency: settings.currencyInfo.id,
      overview,
      protocolMap: nextProtocolMap,
      protocols: nextProtocols,
      supportedActions: nextSupportedActions,
    }),
    [settings.currencyInfo.id],
  );

  const buildAllNetworkPayload = useCallback((): IHomeDeFiLegacyPayload => {
    const nextProtocols = new Map<string, IDeFiProtocol>();
    const nextProtocolMap: Record<string, IProtocolSummary> = {};
    const overview = {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
    };
    Array.from(allNetworkResponsesRef.current.values()).forEach((response) => {
      response.protocols.forEach((item) => {
        nextProtocols.set(getProtocolKey(item), item);
      });
      Object.assign(nextProtocolMap, response.protocolMap);
      overview.totalValue += response.overview.totalValue ?? 0;
      overview.totalDebt += response.overview.totalDebt ?? 0;
      overview.totalReward += response.overview.totalReward ?? 0;
      overview.netWorth += response.overview.netWorth ?? 0;
    });
    return buildDeFiPayload({
      nextProtocolMap,
      nextProtocols: Array.from(nextProtocols.values()),
      overview,
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
  }, [deFiSourceIdentity, deFiSourceIdentityKey]);

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
    async (forceRefresh: boolean | 'consumeQuota') => {
      if (
        !fullSourceEnabled ||
        !accountId ||
        !networkId ||
        isAllNetworks ||
        !deFiSourceIdentityKey
      ) {
        return;
      }
      const currentTask = singleNetworkLoadRef.current;
      if (currentTask?.identityKey === deFiSourceIdentityKey) {
        return currentTask.promise;
      }
      const task = (async () => {
        sourceRequestSeqRef.current += 1;
        const requestId = sourceRequestSeqRef.current;
        requestIdRef.current = requestId;
        setIsRefreshing(true);
        setErrorCode(undefined);
        publishDeFiEvidence({
          requestSeq: requestId,
          evidence: { kind: 'loading' },
        });
        try {
          const shouldForceRefresh =
            forceRefresh === 'consumeQuota'
              ? (
                  await backgroundApiProxy.serviceDeFi.consumeManualDeFiForceRefreshQuota()
                ).allowed
              : forceRefresh;
          const [response, nextSupportedActions] = await Promise.all([
            backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
              accountId,
              indexedAccountId,
              networkId,
              saveToLocal: true,
              excludeLowValueProtocols: true,
              sourceCurrencyInfo,
              targetCurrencyInfo,
              isForceRefresh: shouldForceRefresh,
            }),
            loadSupportedActions(),
          ]);
          if (requestIdRef.current === requestId) {
            setProtocols(response.protocols);
            setProtocolMap(response.protocolMap);
            setInitialized(true);
            updateOverview({ overview: response.overview });
            const payload = buildDeFiPayload({
              nextProtocolMap: response.protocolMap,
              nextProtocols: response.protocols,
              nextSupportedActions,
              overview: response.overview,
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
      })();
      const taskEntry = { identityKey: deFiSourceIdentityKey, promise: task };
      singleNetworkLoadRef.current = taskEntry;
      try {
        await task;
      } finally {
        if (singleNetworkLoadRef.current === taskEntry) {
          singleNetworkLoadRef.current = undefined;
        }
      }
    },
    [
      accountId,
      buildDeFiPayload,
      deFiSourceIdentityKey,
      fullSourceEnabled,
      indexedAccountId,
      isAllNetworks,
      loadSupportedActions,
      networkId,
      publishDeFiEvidence,
      sourceCurrencyInfo,
      targetCurrencyInfo,
      updateOverview,
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
      if (refreshCacheOnly) {
        return undefined;
      }
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
      refreshCacheOnly,
      sourceCurrencyInfo,
      targetCurrencyInfo,
    ],
  );

  const handleAllNetworkSettled = useCallback(
    (response: INativeHomeDeFiResponse | undefined, generation: number) => {
      if (!response || refreshCacheOnly) {
        return;
      }
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
      updateOverview({ overview: payload.overview });
      publishDeFiEvidence({
        requestSeq: allNetworkSectionRequestSeqRef.current,
        evidence: {
          kind: 'partial',
          data: payload,
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
      refreshCacheOnly,
      updateOverview,
    ],
  );
  const clearAllNetworkData = useCallback(() => {
    if (refreshCacheOnly) {
      return;
    }
    setProtocols([]);
    setProtocolMap({});
  }, [refreshCacheOnly]);
  const handleAllNetworkStarted = useCallback(
    async ({
      accountId: ownerAccountId,
      networkId: ownerNetworkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      if (refreshCacheOnly) {
        deFiRawDataRef.current =
          (await backgroundApiProxy.simpleDb.deFi.getRawData()) ?? undefined;
        return;
      }
      allNetworkRequestOutcomeRef.current =
        createNativeHomeAllNetworkRequestOutcome();
      allNetworkExpectedRequestCountRef.current = 0;
      allNetworkEmptyAccountsResolvedRef.current = false;
      allNetworkStartedSucceededRef.current = false;
      allNetworkSourceIdentityKeyRef.current = deFiSourceIdentityKey;
      allNetworkResponsesRef.current.clear();
      sourceRequestSeqRef.current += 1;
      const requestSeq = sourceRequestSeqRef.current;
      allNetworkSectionRequestSeqRef.current = requestSeq;
      setIsRefreshing(true);
      setErrorCode(undefined);
      publishDeFiEvidence({
        requestSeq,
        evidence: { kind: 'loading' },
      });
      if (allNetworkConsumeForceRefreshQuotaRef.current) {
        allNetworkConsumeForceRefreshQuotaRef.current = false;
        allNetworkForceRefreshRef.current = (
          await backgroundApiProxy.serviceDeFi.consumeManualDeFiForceRefreshQuota()
        ).allowed;
      }
      await Promise.all([
        loadSupportedActions(),
        backgroundApiProxy.simpleDb.deFi.getRawData().then((rawData) => {
          deFiRawDataRef.current = rawData ?? undefined;
        }),
        ownerAccountId && ownerNetworkId
          ? backgroundApiProxy.serviceDeFi.updateCurrentAccount({
              accountId: ownerAccountId,
              networkId: ownerNetworkId,
            })
          : Promise.resolve(),
      ]);
      allNetworkStartedSucceededRef.current = true;
    },
    [
      deFiSourceIdentityKey,
      loadSupportedActions,
      publishDeFiEvidence,
      refreshCacheOnly,
    ],
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
    if (refreshCacheOnly) {
      return;
    }
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
    const payload = buildAllNetworkPayload();
    const rowIds = getHomeDeFiProtocolRowIds(payload);
    const overview = Array.from(allNetworkResponsesRef.current.values()).reduce(
      (result, response) => ({
        totalValue: result.totalValue + (response.overview.totalValue ?? 0),
        totalDebt: result.totalDebt + (response.overview.totalDebt ?? 0),
        totalReward: result.totalReward + (response.overview.totalReward ?? 0),
        netWorth: result.netWorth + (response.overview.netWorth ?? 0),
      }),
      { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
    );
    updateOverview({ overview });
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
    refreshCacheOnly,
    updateOverview,
  ]);

  const handleAllNetworkCacheRequest = useCallback(
    async ({
      accountAddress,
      accountId: childAccountId,
      networkId: childNetworkId,
      xpub,
    }: {
      accountAddress: string;
      accountId: string;
      networkId: string;
      xpub?: string;
    }) => {
      const localOverview =
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: [
            {
              accountAddress,
              accountId: childAccountId,
              networkId: childNetworkId,
              xpub,
            },
          ],
          deFiRawData: deFiRawDataRef.current,
        });
      const rawOverview = localOverview?.[0]?.overview?.[childNetworkId];
      if (!rawOverview) {
        return undefined;
      }
      let overview = rawOverview;
      if (rawOverview.currency !== settings.currencyInfo.id) {
        const cacheSourceCurrency = currencyMap[rawOverview.currency];
        const cacheTargetCurrency = currencyMap[settings.currencyInfo.id];
        if (cacheSourceCurrency && cacheTargetCurrency) {
          overview = {
            ...rawOverview,
            ...convertDeFiOverviewValues(
              rawOverview,
              cacheSourceCurrency.value,
              cacheTargetCurrency.value,
            ),
          };
        }
      }
      return { networkId: childNetworkId, overview };
    },
    [currencyMap, settings.currencyInfo.id],
  );

  const handleAllNetworkCacheData = useCallback(
    async ({
      data,
    }: {
      data: Array<{
        overview: {
          totalValue: number;
          totalDebt: number;
          totalReward: number;
          netWorth: number;
        };
      }>;
    }) => {
      const overview = data.reduce(
        (result, item) => ({
          totalValue: result.totalValue + item.overview.totalValue,
          totalDebt: result.totalDebt + item.overview.totalDebt,
          totalReward: result.totalReward + item.overview.totalReward,
          netWorth: result.netWorth + item.overview.netWorth,
        }),
        { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
      );
      updateOverview({ overview });
    },
    [updateOverview],
  );

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
    allNetworkCacheRequests: handleAllNetworkCacheRequest,
    allNetworkCacheData: handleAllNetworkCacheData,
    allNetworkAccountsData: handleAllNetworkAccountsData,
    clearAllNetworkData,
    disabled: !enabled,
    isDeFiRequests: true,
    // Store-backed Home sections prefetch independently from the visible tab.
    // `useAllNetworkRequests` still blocks while the app is locked.
    shouldAlwaysFetch: enabled,
    onRequestSettled: handleAllNetworkSettled,
    onStarted: handleAllNetworkStarted,
    onFinished: handleAllNetworkFinished,
    runIdentityKey: deFiSourceIdentityKey,
  });

  useEffect(() => {
    if (!allNetworkResult) {
      return;
    }
    const authoritativeResponses = allNetworkResult.filter(
      (response) => response.isSameAllNetworksAccountData !== false,
    );
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

  const refreshSingleNetworkOverviewCache = useCallback(
    async ({
      targetAccountId,
      targetNetworkId,
    }: {
      targetAccountId: string;
      targetNetworkId: string;
    }) => {
      updateOverviewDeFiDataState({
        accountId: targetAccountId,
        isReady: undefined,
        networkId: targetNetworkId,
      });
      try {
        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId: targetAccountId,
            networkId: targetNetworkId,
          });
        const localOverview =
          await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountAddress,
                accountId: targetAccountId,
                networkId: targetNetworkId,
              },
            ],
          });
        const rawOverview = localOverview?.[0]?.overview?.[targetNetworkId];
        if (!rawOverview) {
          updateOverviewDeFiDataState({
            accountId: targetAccountId,
            isReady: false,
            networkId: targetNetworkId,
          });
          return;
        }
        let overview = rawOverview;
        if (rawOverview.currency !== settings.currencyInfo.id) {
          const cacheSourceCurrency = currencyMap[rawOverview.currency];
          const cacheTargetCurrency = currencyMap[settings.currencyInfo.id];
          if (cacheSourceCurrency && cacheTargetCurrency) {
            overview = {
              ...rawOverview,
              ...convertDeFiOverviewValues(
                rawOverview,
                cacheSourceCurrency.value,
                cacheTargetCurrency.value,
              ),
            };
          }
        }
        updateOverview({
          overview,
          ownerAccountId: targetAccountId,
          ownerNetworkId: targetNetworkId,
        });
      } catch {
        updateOverviewDeFiDataState({
          accountId: targetAccountId,
          isReady: false,
          networkId: targetNetworkId,
        });
      }
    },
    [
      currencyMap,
      settings.currencyInfo.id,
      updateOverview,
      updateOverviewDeFiDataState,
    ],
  );

  useEffect(() => {
    if (
      !enabled ||
      !refreshCacheOnly ||
      isAllNetworks ||
      !accountId ||
      !networkId
    ) {
      return;
    }
    let cancelled = false;
    updateOverviewDeFiDataState({
      accountId,
      isReady: undefined,
      networkId,
    });
    void (async () => {
      try {
        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          });
        const localOverview =
          await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [{ accountAddress, accountId, networkId }],
          });
        if (cancelled) {
          return;
        }
        const rawOverview = localOverview?.[0]?.overview?.[networkId];
        if (!rawOverview) {
          updateOverviewDeFiDataState({ accountId, isReady: false, networkId });
          return;
        }
        let overview = rawOverview;
        if (rawOverview.currency !== settings.currencyInfo.id) {
          const cacheSourceCurrency = currencyMap[rawOverview.currency];
          const cacheTargetCurrency = currencyMap[settings.currencyInfo.id];
          if (cacheSourceCurrency && cacheTargetCurrency) {
            overview = {
              ...rawOverview,
              ...convertDeFiOverviewValues(
                rawOverview,
                cacheSourceCurrency.value,
                cacheTargetCurrency.value,
              ),
            };
          }
        }
        updateOverview({ overview });
      } catch {
        if (!cancelled) {
          updateOverviewDeFiDataState({ accountId, isReady: false, networkId });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    accountId,
    currencyMap,
    enabled,
    isAllNetworks,
    networkId,
    refreshCacheOnly,
    settings.currencyInfo.id,
    updateOverview,
    updateOverviewDeFiDataState,
  ]);

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    const ownerScope =
      accountId && networkId && walletId
        ? `${walletId}:${accountId}:${networkId}`
        : undefined;
    if (renderedOwnerScopeRef.current !== ownerScope) {
      renderedOwnerScopeRef.current = ownerScope;
      setProtocols([]);
      setProtocolMap({});
      setInitialized(false);
      setErrorCode(undefined);
    }
    if (!fullSourceEnabled || !accountId || !networkId || !walletId) {
      return;
    }
    if (!isAllNetworks) {
      void loadSingle(false);
    }
  }, [
    accountId,
    fullSourceEnabled,
    isAllNetworks,
    loadSingle,
    networkId,
    walletId,
  ]);

  useEffect(() => {
    if (fullSourceEnabled && isAllNetworks && isEmptyAccount) {
      setProtocols([]);
      setProtocolMap({});
      setInitialized(true);
    }
  }, [fullSourceEnabled, isAllNetworks, isEmptyAccount]);

  const actionRefreshTargetRef = useRef<string | undefined>(undefined);
  const lastPositionRefreshFingerprintRef = useRef<string | undefined>(
    undefined,
  );
  const applyPositionRefresh = useCallback(
    ({
      payload,
      requestSeq,
    }: {
      payload: IAppEventBusPayload[EAppEventBusNames.DeFiPositionRefreshed];
      requestSeq: number;
    }) => {
      const ownerMatches =
        accountId &&
        networkId &&
        (account?.indexedAccountId && payload.indexedAccountId
          ? account.indexedAccountId === payload.indexedAccountId
          : accountId === payload.accountId);
      if (!ownerMatches) {
        publishDeFiEvidence({
          requestSeq,
          evidence: { kind: 'error', errorKind: 'source' },
        });
        return;
      }
      let nextProtocols = payload.protocols;
      let nextProtocolMap = payload.protocolMap;
      if (isAllNetworks) {
        nextProtocols = protocolsRef.current
          .filter((protocol) => protocol.networkId !== payload.networkId)
          .concat(payload.protocols);
        nextProtocolMap = Object.fromEntries(
          Object.entries(protocolMapRef.current).filter(
            ([key]) => !key.startsWith(`${payload.networkId}-`),
          ),
        );
        Object.assign(nextProtocolMap, payload.protocolMap);
      } else if (
        payload.accountId !== accountId ||
        payload.networkId !== networkId
      ) {
        publishDeFiEvidence({
          requestSeq,
          evidence: { kind: 'error', errorKind: 'source' },
        });
        return;
      }
      const overview = isAllNetworks
        ? Object.values(nextProtocolMap).reduce(
            (result, summary) => ({
              totalValue: result.totalValue + (summary.totalValue ?? 0),
              totalDebt: result.totalDebt + (summary.totalDebt ?? 0),
              totalReward: result.totalReward + (summary.totalReward ?? 0),
              netWorth: result.netWorth + (summary.netWorth ?? 0),
            }),
            { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
          )
        : payload.overview;
      const data = buildDeFiPayload({
        nextProtocolMap,
        nextProtocols,
        overview,
      });
      const rowIds = getHomeDeFiProtocolRowIds(data);
      updateOverview({ overview });
      publishDeFiEvidence({
        requestSeq,
        evidence: {
          kind: 'complete',
          confirmedEmpty: rowIds.length === 0,
          coverageFingerprint: buildHomeDeFiCoverage({
            requestSeq,
            rowCount: rowIds.length,
            source: isAllNetworks ? 'allNetworks' : 'singleNetwork',
          }),
          data,
          rowIds,
        },
      });
    },
    [
      account?.indexedAccountId,
      accountId,
      buildDeFiPayload,
      isAllNetworks,
      networkId,
      publishDeFiEvidence,
      updateOverview,
    ],
  );

  useEffect(() => {
    if (!fullSourceEnabled) {
      return;
    }
    const onPositionRefreshed = (
      payload: IAppEventBusPayload[EAppEventBusNames.DeFiPositionRefreshed],
    ) => {
      const fingerprint = stringUtils.stableStringify(payload);
      if (
        actionRefreshTargetRef.current ===
          `${payload.accountId}:${payload.networkId}` ||
        lastPositionRefreshFingerprintRef.current === fingerprint
      ) {
        return;
      }
      lastPositionRefreshFingerprintRef.current = fingerprint;
      sourceRequestSeqRef.current += 1;
      const requestSeq = sourceRequestSeqRef.current;
      publishDeFiEvidence({ requestSeq, evidence: { kind: 'loading' } });
      applyPositionRefresh({ payload, requestSeq });
    };
    const unsubscribeIntent = subscribeHomeDeFiSourceCommand(async (intent) => {
      if (intent.type !== 'positionActionSucceeded') {
        return;
      }
      const target = `${intent.payload.accountId}:${intent.payload.networkId}`;
      actionRefreshTargetRef.current = target;
      sourceRequestSeqRef.current += 1;
      const requestSeq = sourceRequestSeqRef.current;
      publishDeFiEvidence({ requestSeq, evidence: { kind: 'loading' } });
      try {
        const payload =
          await backgroundApiProxy.serviceDeFi.refreshAccountDeFiPositionsAfterAction(
            intent.payload,
          );
        if (payload) {
          lastPositionRefreshFingerprintRef.current =
            stringUtils.stableStringify(payload);
          applyPositionRefresh({ payload, requestSeq });
        } else {
          publishDeFiEvidence({
            requestSeq,
            evidence: { kind: 'error', errorKind: 'source' },
          });
        }
      } catch {
        publishDeFiEvidence({
          requestSeq,
          evidence: { kind: 'error', errorKind: 'source' },
        });
      } finally {
        if (actionRefreshTargetRef.current === target) {
          actionRefreshTargetRef.current = undefined;
        }
      }
    });
    appEventBus.on(
      EAppEventBusNames.DeFiPositionRefreshed,
      onPositionRefreshed,
    );
    return () => {
      unsubscribeIntent();
      appEventBus.off(
        EAppEventBusNames.DeFiPositionRefreshed,
        onPositionRefreshed,
      );
    };
  }, [applyPositionRefresh, fullSourceEnabled, publishDeFiEvidence]);

  const refresh = useCallback(async () => {
    if (refreshCacheOnly) {
      if (isAllNetworks) {
        await runAllNetwork({ alwaysSetState: true });
      } else if (accountId && networkId) {
        await refreshSingleNetworkOverviewCache({
          targetAccountId: accountId,
          targetNetworkId: networkId,
        });
      }
      return;
    }
    if (isAllNetworks) {
      allNetworkConsumeForceRefreshQuotaRef.current = true;
      await runAllNetwork({
        alwaysSetState: true,
        skipAccountsCache: true,
      });
    } else {
      await loadSingle('consumeQuota');
    }
  }, [
    accountId,
    isAllNetworks,
    loadSingle,
    networkId,
    refreshCacheOnly,
    refreshSingleNetworkOverviewCache,
    runAllNetwork,
  ]);

  useEffect(() => {
    if (!fullSourceEnabled || !visible) {
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
  }, [fullSourceEnabled, isAllNetworks, loadSingle, runAllNetwork, visible]);

  useEffect(() => {
    if (!enabled || !refreshCacheOnly) {
      return;
    }
    const refreshProvidedAccount = (
      payload: IAppEventBusPayload[EAppEventBusNames.RefreshTokenList],
    ) => {
      const target = payload?.refreshByProvidedAccounts
        ? payload.accounts?.[0]
        : undefined;
      if (target) {
        void refreshSingleNetworkOverviewCache({
          targetAccountId: target.accountId,
          targetNetworkId: target.networkId,
        });
      }
    };
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refreshProvidedAccount);
    return () => {
      appEventBus.off(
        EAppEventBusNames.RefreshTokenList,
        refreshProvidedAccount,
      );
    };
  }, [enabled, refreshCacheOnly, refreshSingleNetworkOverviewCache]);

  return useMemo(
    () => ({
      errorCode,
      initialized,
      isRefreshing,
      protocolMap,
      protocols,
      supportedActions,
      refresh,
    }),
    [
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
