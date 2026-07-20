import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { uniqBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHomeActions } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { POLLING_INTERVAL_FOR_NFT } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IAccountNFT,
  IFetchAccountNFTsResp,
} from '@onekeyhq/shared/types/nft';

import { useAllNetworkRequests } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import {
  useHomeFactsShadow,
  useHomeSectionSemantic,
} from './model/react/homeSemanticHooks';
import { HomeSectionCoordinator } from './model/sections/homeSectionCoordinator';
import {
  buildHomeNFTCoverage,
  projectHomeNFTSectionSource,
} from './model/sections/nft/homeNFTSectionPolicy';
import {
  adaptHomeNFTSourceSnapshot,
  createHomeNFTSourceIdentity,
  getHomeNFTRowIds,
} from './model/sections/nft/homeNFTSourceAdapter';
import {
  createNativeHomeAllNetworkRequestOutcome,
  recordNativeHomeAllNetworkFailure,
  recordNativeHomeAllNetworkResponse,
  resolveNativeHomeAllNetworkAuthorityStatus,
} from './nativeHomeAllNetworkAuthority';

import type { IHomeSectionCoordinatorResolution } from './model/sections/homeSectionCoordinator';
import type { IHomeNFTEvidence } from './model/sections/nft/homeNFTSectionPolicy';
import type {
  IHomeNFTLegacyPayload,
  IHomeNFTSourceParams,
} from './model/sections/nft/homeNFTSourceAdapter';

let nativeHomeNFTProducerInstance = 0;

function createNativeHomeNFTProducerInstanceId() {
  nativeHomeNFTProducerInstance += 1;
  return `native-home-nft:${nativeHomeNFTProducerInstance}`;
}

export interface INativeHomeNFTData {
  data: IAccountNFT[];
  errorCode: string | undefined;
  initialized: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const getNFTKey = (nft: IAccountNFT) =>
  `${nft.networkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`;

const getAllNetworkResponseKey = (
  response: IFetchAccountNFTsResp,
  fallbackIndex: number,
) => {
  const rowIds = getHomeNFTRowIds({ data: response.data });
  return rowIds.length
    ? stringUtils.stableStringify(rowIds)
    : `empty:${fallbackIndex}`;
};

export function useNativeHomeNFTData({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}): INativeHomeNFTData {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [data, setData] = useState<IAccountNFT[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
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
  const nftSemanticRevisionRef = useRef(0);
  const allNetworkSectionRequestSeqRef = useRef(0);
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const homeFactsShadow = useHomeFactsShadow();
  const homeNFTSemantic = useHomeSectionSemantic('nft');
  const { clearSemanticSection, publishSemanticSection } =
    useHomeActions().current;
  const [nftProducerInstanceId] = useState(
    createNativeHomeNFTProducerInstanceId,
  );
  const nftSourceIdentity = useMemo(() => {
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
    const params: IHomeNFTSourceParams = {
      accountId,
      indexedAccountId,
      networkId,
      walletId,
      networkMode: isAllNetworks ? 'allNetworks' : 'singleNetwork',
    };
    return createHomeNFTSourceIdentity({
      owner: homeFactsShadow.ownerToken,
      params,
      producerInstanceId: nftProducerInstanceId,
    });
  }, [
    accountId,
    enabled,
    homeFactsShadow,
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

  useEffect(() => {
    nftSemanticRevisionRef.current = Math.max(
      nftSemanticRevisionRef.current,
      homeNFTSemantic?.revision ?? 0,
    );
  }, [homeNFTSemantic?.revision]);

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

  const publishNFTEvidence = useCallback(
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
      nftSemanticRevisionRef.current += 1;
      publishSemanticSection({
        owner: nftSourceIdentity.owner,
        revision: nftSemanticRevisionRef.current,
        sectionId: 'nft',
        value: resolution.semantic,
      });
      applyAuthoritativeNFTPayload(resolution);
      return resolution;
    },
    [
      applyAuthoritativeNFTPayload,
      nftSourceIdentity,
      nftSourceIdentityKey,
      publishSemanticSection,
    ],
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
    if (homeFactsShadow) {
      nftSemanticRevisionRef.current += 1;
      clearSemanticSection({
        owner: homeFactsShadow.ownerToken,
        revision: nftSemanticRevisionRef.current,
        sectionId: 'nft',
      });
    }
  }, [
    clearSemanticSection,
    homeFactsShadow,
    nftSourceIdentity,
    nftSourceIdentityKey,
  ]);

  useEffect(
    () => () => {
      nftCoordinatorRef.current?.dispose();
    },
    [],
  );

  const loadSingle = useCallback(
    async (manual: boolean) => {
      if (!enabled || !accountId || !networkId || isAllNetworks) {
        return;
      }
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      publishNFTEvidence({
        requestSeq: requestId,
        evidence: { kind: 'loading' },
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
          publishNFTEvidence({
            requestSeq: requestId,
            evidence: {
              kind: 'complete',
              confirmedEmpty: result.data.length === 0,
              coverageFingerprint: buildHomeNFTCoverage({
                requestSeq: requestId,
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
          publishNFTEvidence({
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
    [accountId, enabled, isAllNetworks, networkId, publishNFTEvidence],
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
        publishNFTEvidence({
          requestSeq: allNetworkSectionRequestSeqRef.current,
          evidence: {
            kind: 'confirmedCache',
            data: { data: next },
            rowIds: getHomeNFTRowIds({ data: next }),
            refresh: 'refreshing',
          },
        });
      }
    },
    [isAllNetworkSourceCurrent, publishNFTEvidence],
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
      publishNFTEvidence({
        requestSeq: allNetworkSectionRequestSeqRef.current,
        evidence: {
          kind: 'partial',
          coverageFingerprint: `nft:allNetworks:${
            allNetworkSectionRequestSeqRef.current
          }:settled:${
            allNetworkRequestOutcomeRef.current.attemptCount
          }:expected:${
            allNetworkExpectedRequestCountRef.current
          }:rows:${getHomeNFTRowIds(payload).length}:partial`,
        },
      });
    },
    [buildAllNetworkPayload, isAllNetworkSourceCurrent, publishNFTEvidence],
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
      allNetworkSectionRequestSeqRef.current += 1;
      const requestSeq = allNetworkSectionRequestSeqRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      publishNFTEvidence({
        requestSeq,
        evidence: { kind: 'loading' },
      });
      if (ownerAccountId && ownerNetworkId) {
        await backgroundApiProxy.serviceNFT.updateCurrentAccount({
          accountId: ownerAccountId,
          networkId: ownerNetworkId,
        });
      }
      allNetworkStartedSucceededRef.current = true;
    },
    [nftSourceIdentityKey, publishNFTEvidence],
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
    const payload = buildAllNetworkPayload();
    const rowIds = getHomeNFTRowIds(payload);
    if (allNetworkEmptyAccountsResolvedRef.current) {
      publishNFTEvidence({
        requestSeq,
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
      publishNFTEvidence({
        requestSeq,
        evidence: { kind: 'error', errorKind: 'source' },
      });
    } else {
      publishNFTEvidence({
        requestSeq,
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
    setIsRefreshing(false);
    setInitialized(true);
  }, [buildAllNetworkPayload, isAllNetworkSourceCurrent, publishNFTEvidence]);

  const { run: runAllNetwork, isEmptyAccount } =
    useAllNetworkRequests<IFetchAccountNFTsResp>({
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
      isNFTRequests: true,
      onRequestSettled: handleAllNetworkSettled,
      onStarted: handleAllNetworkStarted,
      onFinished: handleAllNetworkFinished,
    });

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    allNetworkResponsesRef.current.clear();
    setData([]);
    setInitialized(false);
    setErrorCode(undefined);
    if (!enabled || !accountId || !networkId || !walletId) {
      return;
    }
    void backgroundApiProxy.serviceNFT.updateCurrentAccount({
      accountId,
      networkId,
    });
    if (isAllNetworks) {
      return;
    }
    void (async () => {
      const requestId = requestIdRef.current;
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
            publishNFTEvidence({
              requestSeq: requestId,
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
      await loadSingle(false);
    })();
  }, [
    accountId,
    enabled,
    isAllNetworks,
    loadSingle,
    networkId,
    nftSourceIdentityKey,
    publishNFTEvidence,
    walletId,
  ]);

  useEffect(() => {
    if (enabled && isAllNetworks && isEmptyAccount) {
      setData([]);
      setInitialized(true);
      publishNFTEvidence({
        requestSeq: allNetworkSectionRequestSeqRef.current,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeNFTCoverage({
            requestSeq: allNetworkSectionRequestSeqRef.current,
            rowCount: 0,
            source: 'allNetworks',
          }),
          data: undefined,
          rowIds: [],
        },
      });
    }
  }, [enabled, isAllNetworks, isEmptyAccount, publishNFTEvidence]);

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
    const reloadAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      reload();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const timer = setInterval(reload, POLLING_INTERVAL_FOR_NFT);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [enabled, refresh, visible]);

  return useMemo(
    () => ({ data, errorCode, initialized, isRefreshing, refresh }),
    [data, errorCode, initialized, isRefreshing, refresh],
  );
}
