import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { uniqBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { POLLING_INTERVAL_FOR_NFT } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountNFT,
  IFetchAccountNFTsResp,
} from '@onekeyhq/shared/types/nft';

import {
  createNativeHomeAllNetworkRequestOutcome,
  recordNativeHomeAllNetworkFailure,
  recordNativeHomeAllNetworkResponse,
  resolveNativeHomeAllNetworkAuthorityStatus,
} from '../../nativeHomeAllNetworkAuthority';
import {
  HomeSectionCoordinator,
  type IHomeSectionCoordinatorResolution,
} from '../sections/homeSectionCoordinator';
import {
  type IHomeNFTEvidence,
  buildHomeNFTCoverage,
  projectHomeNFTSectionSource,
} from '../sections/nft/homeNFTSectionPolicy';
import {
  HOME_NFT_DATA_SCHEMA_VERSION,
  type IHomeNFTLegacyPayload,
  type IHomeNFTSourceParams,
  adaptHomeNFTSourceSnapshot,
  createHomeNFTSourceIdentity,
  getHomeNFTRowIds,
} from '../sections/nft/homeNFTSourceAdapter';
import {
  createHomeStoreSectionSourceResult,
  normalizeHomeStoreJson,
} from '../store/homeStoreJson';

import { useHomeFactsSnapshot } from './homeStoreHooks';
import {
  type IHomeSectionSourceRequestHandle,
  useHomeStoreSourcePublisher,
} from './useHomeStoreSourcePublisher';

let homeNFTStoreProducerInstance = 0;

function createHomeNFTStoreProducerInstanceId() {
  homeNFTStoreProducerInstance += 1;
  return `home-nft-store:${homeNFTStoreProducerInstance}`;
}

export interface IHomeNFTStoreSource {
  data: IAccountNFT[];
  errorCode: string | undefined;
  initialized: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const getNFTKey = (nft: IAccountNFT) =>
  `${nft.networkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`;

function emitNFTListStateUpdate({
  accountId,
  isRefreshing,
  networkId,
}: {
  accountId: string;
  isRefreshing: boolean;
  networkId: string;
}) {
  appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
    accountId,
    isRefreshing,
    networkId,
    type: EHomeTab.NFT,
  });
}

const getAllNetworkResponseKey = (
  response: IFetchAccountNFTsResp,
  fallbackIndex: number,
) => {
  const rowIds = getHomeNFTRowIds({ data: response.data });
  return rowIds.length
    ? stringUtils.stableStringify(rowIds)
    : `empty:${fallbackIndex}`;
};

export function useHomeNFTStoreSource({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}): IHomeNFTStoreSource {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const { updateAllNetworksState } = useAccountOverviewActions().current;
  const [data, setData] = useState<IAccountNFT[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
  const singleRequestOwnerKeyRef = useRef<string | undefined>(undefined);
  const allNetworkGenerationRef = useRef(0);
  const allNetworkManualRef = useRef(false);
  const allNetworkRequestOutcomeRef = useRef(
    createNativeHomeAllNetworkRequestOutcome(),
  );
  const allNetworkExpectedRequestCountRef = useRef(0);
  const allNetworkEmptyAccountsResolvedRef = useRef(false);
  const allNetworkStartedSucceededRef = useRef(false);
  const allNetworkSourceIdentityKeyRef = useRef<string | undefined>(undefined);
  const allNetworkResponsesRef = useRef(
    new Map<string, IFetchAccountNFTsResp>(),
  );
  const nftCoordinatorRef = useRef<
    HomeSectionCoordinator<IHomeNFTLegacyPayload> | undefined
  >(undefined);
  const allNetworkRequestHandleRef = useRef<
    IHomeSectionSourceRequestHandle | undefined
  >(undefined);
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const homeFactsSnapshot = useHomeFactsSnapshot();
  const {
    beginHomeSectionRequest,
    completeHomeSectionRequest,
    resetHomeSectionSource,
  } = useHomeStoreSourcePublisher();
  const [nftProducerInstanceId] = useState(
    createHomeNFTStoreProducerInstanceId,
  );
  const nftSourceIdentity = useMemo(() => {
    const ownerMatches =
      homeFactsSnapshot?.owner.walletId === walletId &&
      homeFactsSnapshot?.owner.accountId === accountId &&
      (isAllNetworks
        ? homeFactsSnapshot?.owner.network.kind === 'allNetworks'
        : homeFactsSnapshot?.owner.network.kind === 'singleNetwork' &&
          homeFactsSnapshot.owner.network.networkId === networkId);
    if (
      !enabled ||
      !ownerMatches ||
      !homeFactsSnapshot ||
      !accountId ||
      !networkId ||
      !walletId
    ) {
      return undefined;
    }
    const params: IHomeNFTSourceParams = {
      accountId,
      indexedAccountId,
      networkId,
      walletId,
      networkMode: isAllNetworks ? 'allNetworks' : 'singleNetwork',
    };
    return createHomeNFTSourceIdentity({
      owner: homeFactsSnapshot.ownerToken,
      params,
      producerInstanceId: nftProducerInstanceId,
    });
  }, [
    accountId,
    enabled,
    homeFactsSnapshot,
    indexedAccountId,
    isAllNetworks,
    networkId,
    nftProducerInstanceId,
    walletId,
  ]);
  const nftSourceIdentityKey = useMemo(
    () =>
      nftSourceIdentity
        ? stringUtils.stableStringify(nftSourceIdentity)
        : undefined,
    [nftSourceIdentity],
  );

  const applyAuthoritativeNFTPayload = useCallback(
    (resolution: IHomeSectionCoordinatorResolution<IHomeNFTLegacyPayload>) => {
      if (resolution.authoritative.kind === 'none') {
        return;
      }
      setData(resolution.authoritative.data.data);
      setInitialized(true);
    },
    [],
  );

  const resolveNFTEvidence = useCallback(
    ({
      evidence,
      requestSeq,
    }: {
      evidence: IHomeNFTEvidence;
      requestSeq: number;
    }) => {
      if (!nftSourceIdentity || !nftSourceIdentityKey) {
        return undefined;
      }
      let coordinator = nftCoordinatorRef.current;
      if (!coordinator) {
        coordinator = new HomeSectionCoordinator<IHomeNFTLegacyPayload>(
          nftSourceIdentity,
        );
        nftCoordinatorRef.current = coordinator;
      } else {
        coordinator.setOwner(nftSourceIdentity);
      }
      const resolution = coordinator.dispatch(
        adaptHomeNFTSourceSnapshot({
          identity: nftSourceIdentity,
          snapshot: projectHomeNFTSectionSource({
            authorityReady: true,
            evidence,
            requestSeq,
            scopeMatches: true,
          }),
        }),
      );
      if (!resolution.accepted) {
        return resolution;
      }
      applyAuthoritativeNFTPayload(resolution);
      return resolution;
    },
    [applyAuthoritativeNFTPayload, nftSourceIdentity, nftSourceIdentityKey],
  );

  const beginNFTRequest = useCallback(() => {
    if (!nftSourceIdentity) {
      return undefined;
    }
    return beginHomeSectionRequest({
      dataSchemaVersion: HOME_NFT_DATA_SCHEMA_VERSION,
      ownerToken: nftSourceIdentity.owner,
      paramsFingerprint: nftSourceIdentity.sourceKeyIdentity,
      sectionId: 'nft',
    });
  }, [beginHomeSectionRequest, nftSourceIdentity]);

  const completeNFTEvidence = useCallback(
    ({
      evidence,
      handle,
    }: {
      evidence: IHomeNFTEvidence;
      handle: IHomeSectionSourceRequestHandle;
    }) => {
      const resolution = resolveNFTEvidence({
        evidence,
        requestSeq: handle.token.requestSeq,
      });
      if (!resolution?.accepted) {
        return resolution;
      }
      const normalizedData =
        resolution.authoritative.kind === 'none'
          ? undefined
          : normalizeHomeStoreJson(resolution.authoritative.data);
      completeHomeSectionRequest(
        handle,
        createHomeStoreSectionSourceResult(resolution.semantic, normalizedData),
      );
      return resolution;
    },
    [completeHomeSectionRequest, resolveNFTEvidence],
  );

  const buildAllNetworkPayload = useCallback((): IHomeNFTLegacyPayload => {
    const next = new Map<string, IAccountNFT>();
    Array.from(allNetworkResponsesRef.current.values()).forEach((response) => {
      response.data.forEach((item) => {
        next.set(getNFTKey(item), item);
      });
    });
    return { data: Array.from(next.values()) };
  }, []);

  const isAllNetworkSourceCurrent = useCallback(
    () =>
      Boolean(nftSourceIdentityKey) &&
      allNetworkSourceIdentityKeyRef.current === nftSourceIdentityKey,
    [nftSourceIdentityKey],
  );

  useEffect(() => {
    if (nftSourceIdentity && nftSourceIdentityKey) {
      return;
    }
    nftCoordinatorRef.current = undefined;
    if (homeFactsSnapshot) {
      resetHomeSectionSource({
        ownerToken: homeFactsSnapshot.ownerToken,
        sectionId: 'nft',
      });
    }
  }, [
    homeFactsSnapshot,
    nftSourceIdentity,
    nftSourceIdentityKey,
    resetHomeSectionSource,
  ]);

  useEffect(
    () => () => {
      nftCoordinatorRef.current?.dispose();
    },
    [],
  );

  const loadSingle = useCallback(
    async (
      manual: boolean,
      existingHandle?: IHomeSectionSourceRequestHandle,
    ) => {
      if (!enabled || !accountId || !networkId || isAllNetworks) {
        return;
      }
      if (
        !nftSourceIdentityKey ||
        singleRequestOwnerKeyRef.current === nftSourceIdentityKey
      ) {
        return;
      }
      singleRequestOwnerKeyRef.current = nftSourceIdentityKey;
      const handle = existingHandle ?? beginNFTRequest();
      if (!handle) {
        singleRequestOwnerKeyRef.current = undefined;
        return;
      }
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      emitNFTListStateUpdate({
        accountId,
        isRefreshing: true,
        networkId,
      });
      try {
        const result = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
          accountId,
          networkId,
          isManualRefresh: manual,
          saveToLocal: true,
        });
        if (requestIdRef.current === requestId) {
          const payload = { data: result.data };
          const rowIds = getHomeNFTRowIds(payload);
          completeNFTEvidence({
            handle,
            evidence: {
              kind: 'complete',
              confirmedEmpty: result.data.length === 0,
              coverageFingerprint: buildHomeNFTCoverage({
                requestSeq: handle.token.requestSeq,
                rowCount: rowIds.length,
                source: 'singleNetwork',
              }),
              data: payload,
              rowIds,
            },
          });
          if (rowIds.length === 0) {
            setData([]);
            setInitialized(true);
          }
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorCode('nft_fetch_failed');
          setInitialized(true);
          completeNFTEvidence({
            handle,
            evidence: { kind: 'error', errorKind: 'source' },
          });
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsRefreshing(false);
          emitNFTListStateUpdate({
            accountId,
            isRefreshing: false,
            networkId,
          });
        }
        if (singleRequestOwnerKeyRef.current === nftSourceIdentityKey) {
          singleRequestOwnerKeyRef.current = undefined;
        }
      }
    },
    [
      accountId,
      beginNFTRequest,
      completeNFTEvidence,
      enabled,
      isAllNetworks,
      networkId,
      nftSourceIdentityKey,
    ],
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
      try {
        const response = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
          accountId: childAccountId,
          networkId: childNetworkId,
          dbAccount,
          isAllNetworks: true,
          isManualRefresh: allNetworkManualRef.current,
          allNetworksAccountId: accountId,
          allNetworksNetworkId: networkId,
          saveToLocal: true,
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
    [accountId, networkId],
  );

  const readAllNetworkCache = useCallback(
    ({
      accountId: childAccountId,
      networkId: childNetworkId,
      dbAccount,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
    }) =>
      backgroundApiProxy.serviceNFT.getAccountLocalNFTs({
        accountId: childAccountId,
        networkId: childNetworkId,
        dbAccount,
      }),
    [],
  );

  const applyAllNetworkCache = useCallback(
    async ({
      data: cached,
      generation,
    }: {
      data: IAccountNFT[][];
      generation: number;
    }) => {
      if (
        generation < allNetworkGenerationRef.current ||
        !isAllNetworkSourceCurrent()
      ) {
        return;
      }
      const next = uniqBy(cached.flat(), getNFTKey);
      if (next.length > 0) {
        allNetworkGenerationRef.current = generation;
        const handle = allNetworkRequestHandleRef.current;
        if (!handle) {
          return;
        }
        resolveNFTEvidence({
          requestSeq: handle.token.requestSeq,
          evidence: {
            kind: 'confirmedCache',
            data: { data: next },
            rowIds: getHomeNFTRowIds({ data: next }),
            refresh: 'refreshing',
          },
        });
      }
    },
    [isAllNetworkSourceCurrent, resolveNFTEvidence],
  );

  const handleAllNetworkSettled = useCallback(
    (result: IFetchAccountNFTsResp, generation: number) => {
      if (result.isSameAllNetworksAccountData === false) {
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
        getAllNetworkResponseKey(result, allNetworkResponsesRef.current.size),
        result,
      );
      const payload = buildAllNetworkPayload();
      setData(payload.data);
      setInitialized(true);
    },
    [buildAllNetworkPayload, isAllNetworkSourceCurrent],
  );
  const clearAllNetworkData = useCallback(() => {
    setData([]);
  }, []);
  const handleAllNetworkStarted = useCallback(
    async ({
      accountId: ownerAccountId,
      networkId: ownerNetworkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      allNetworkRequestOutcomeRef.current =
        createNativeHomeAllNetworkRequestOutcome();
      allNetworkExpectedRequestCountRef.current = 0;
      allNetworkEmptyAccountsResolvedRef.current = false;
      allNetworkStartedSucceededRef.current = false;
      allNetworkSourceIdentityKeyRef.current = nftSourceIdentityKey;
      allNetworkResponsesRef.current.clear();
      if (!nftSourceIdentityKey) {
        return;
      }
      const handle = beginNFTRequest();
      if (!handle) {
        return;
      }
      allNetworkRequestHandleRef.current = handle;
      setIsRefreshing(true);
      setErrorCode(undefined);
      if (ownerAccountId && ownerNetworkId) {
        emitNFTListStateUpdate({
          accountId: ownerAccountId,
          isRefreshing: true,
          networkId: ownerNetworkId,
        });
      }
      if (ownerAccountId && ownerNetworkId) {
        await backgroundApiProxy.serviceNFT.updateCurrentAccount({
          accountId: ownerAccountId,
          networkId: ownerNetworkId,
        });
      }
      allNetworkStartedSucceededRef.current = true;
    },
    [beginNFTRequest, nftSourceIdentityKey],
  );
  const handleAllNetworkAccountsData = useCallback(
    ({
      accounts,
      allAccounts,
    }: {
      accounts: IAllNetworkAccountInfo[];
      allAccounts: IAllNetworkAccountInfo[];
    }) => {
      allNetworkExpectedRequestCountRef.current = accounts.length;
      updateAllNetworksState({
        visibleCount: uniqBy(allAccounts, 'networkId').length,
      });
      if (accounts.length === 0) {
        allNetworkEmptyAccountsResolvedRef.current = true;
      }
    },
    [updateAllNetworksState],
  );
  const handleAllNetworkFinished = useCallback(async () => {
    if (!isAllNetworkSourceCurrent()) {
      return;
    }
    const handle = allNetworkRequestHandleRef.current;
    if (!handle) {
      return;
    }
    const expectedRequestCount = allNetworkExpectedRequestCountRef.current;
    const outcome = allNetworkRequestOutcomeRef.current;
    const requestSeq = handle.token.requestSeq;
    const authorityStatus = resolveNativeHomeAllNetworkAuthorityStatus({
      emptyAccountsResolved: allNetworkEmptyAccountsResolvedRef.current,
      expectedRequestCount,
      outcome,
      startedSucceeded: allNetworkStartedSucceededRef.current,
    });
    const payload = buildAllNetworkPayload();
    const rowIds = getHomeNFTRowIds(payload);
    if (allNetworkEmptyAccountsResolvedRef.current) {
      completeNFTEvidence({
        handle,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeNFTCoverage({
            requestSeq,
            rowCount: 0,
            source: 'allNetworks',
          }),
          data: undefined,
          rowIds: [],
        },
      });
      setData([]);
    } else if (authorityStatus === 'error') {
      setErrorCode('nft_fetch_failed');
      completeNFTEvidence({
        handle,
        evidence: { kind: 'error', errorKind: 'source' },
      });
    } else {
      completeNFTEvidence({
        handle,
        evidence: {
          kind: 'complete',
          confirmedEmpty: rowIds.length === 0,
          coverageFingerprint: buildHomeNFTCoverage({
            requestSeq,
            rowCount: rowIds.length,
            source: 'allNetworks',
          }),
          data: payload,
          rowIds,
        },
      });
      if (rowIds.length === 0) {
        setData([]);
      }
    }
    allNetworkManualRef.current = false;
    allNetworkRequestHandleRef.current = undefined;
    setIsRefreshing(false);
    setInitialized(true);
    if (accountId && networkId) {
      emitNFTListStateUpdate({
        accountId,
        isRefreshing: false,
        networkId,
      });
    }
  }, [
    accountId,
    buildAllNetworkPayload,
    completeNFTEvidence,
    isAllNetworkSourceCurrent,
    networkId,
  ]);

  const { run: runAllNetwork } = useAllNetworkRequests<IFetchAccountNFTsResp>({
    accountId,
    networkId,
    walletId,
    isAllNetworks,
    allNetworkRequests: fetchAllNetwork,
    allNetworkCacheRequests: readAllNetworkCache,
    allNetworkCacheData: applyAllNetworkCache,
    allNetworkAccountsData: handleAllNetworkAccountsData,
    clearAllNetworkData,
    disabled: !enabled || !nftSourceIdentityKey,
    isNFTRequests: true,
    runIdentityKey: nftSourceIdentityKey,
    onRequestSettled: handleAllNetworkSettled,
    onStarted: handleAllNetworkStarted,
    onFinished: handleAllNetworkFinished,
  });

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    allNetworkResponsesRef.current.clear();
    allNetworkRequestHandleRef.current = undefined;
    singleRequestOwnerKeyRef.current = undefined;
    setData([]);
    setInitialized(false);
    setErrorCode(undefined);
    if (!enabled || !accountId || !networkId || !walletId) {
      return;
    }
    if (isAllNetworks) {
      return;
    }
    void (async () => {
      const requestId = requestIdRef.current;
      const handle = beginNFTRequest();
      if (!handle) {
        return;
      }
      try {
        await backgroundApiProxy.serviceNFT.updateCurrentAccount({
          accountId,
          networkId,
        });
      } catch {
        // Account-scoped fetch and cache reads remain authoritative.
      }
      try {
        const cached = await backgroundApiProxy.serviceNFT.getAccountLocalNFTs({
          accountId,
          networkId,
        });
        if (
          requestIdRef.current === requestId &&
          cached.length > 0 &&
          nftSourceIdentityKey
        ) {
          const payload = { data: cached };
          const rowIds = getHomeNFTRowIds(payload);
          if (rowIds.length > 0) {
            resolveNFTEvidence({
              requestSeq: handle.token.requestSeq,
              evidence: {
                kind: 'confirmedCache',
                data: payload,
                rowIds,
                refresh: 'refreshing',
              },
            });
          }
        }
      } catch {
        // The live request below remains authoritative when cache hydration fails.
      }
      if (requestIdRef.current === requestId) {
        await loadSingle(false, handle);
      }
    })();
  }, [
    accountId,
    beginNFTRequest,
    enabled,
    isAllNetworks,
    loadSingle,
    networkId,
    nftSourceIdentityKey,
    resolveNFTEvidence,
    walletId,
  ]);

  const refresh = useCallback(async () => {
    if (isAllNetworks) {
      allNetworkManualRef.current = true;
      await runAllNetwork({ alwaysSetState: true });
    } else {
      await loadSingle(true);
    }
  }, [isAllNetworks, loadSingle, runAllNetwork]);

  useEffect(() => {
    if (!enabled || !visible) {
      return;
    }
    const reload = () => {
      void refresh();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reload);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const timer = setInterval(reload, POLLING_INTERVAL_FOR_NFT);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reload);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [enabled, refresh, visible]);

  return useMemo(
    () => ({ data, errorCode, initialized, isRefreshing, refresh }),
    [data, errorCode, initialized, isRefreshing, refresh],
  );
}
