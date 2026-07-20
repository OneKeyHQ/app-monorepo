import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHomeActions } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_HISTORY } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import {
  useHomeFactsShadow,
  useHomeSectionSemantic,
} from './model/react/homeSemanticHooks';
import {
  buildHomeHistoryCoverage,
  projectHomeHistorySectionSource,
} from './model/sections/history/homeHistorySectionPolicy';
import {
  adaptHomeHistorySourceSnapshot,
  createHomeHistorySourceIdentity,
  getHomeHistoryRowIds,
} from './model/sections/history/homeHistorySourceAdapter';
import { HomeSectionCoordinator } from './model/sections/homeSectionCoordinator';
import { useHistoryListLoadMore } from './pages/hooks/useHistoryListLoadMore';

import type { IHomeHistoryEvidence } from './model/sections/history/homeHistorySectionPolicy';
import type {
  IHomeHistoryLegacyPayload,
  IHomeHistorySourceParams,
} from './model/sections/history/homeHistorySourceAdapter';
import type { IHomeSectionCoordinatorResolution } from './model/sections/homeSectionCoordinator';

let nativeHomeHistoryProducerInstance = 0;

function createNativeHomeHistoryProducerInstanceId() {
  nativeHomeHistoryProducerInstance += 1;
  return `native-home-history:${nativeHomeHistoryProducerInstance}`;
}

export interface INativeHomeHistoryData {
  addressMap: Record<string, IAddressBadge>;
  data: IAccountHistoryTx[];
  errorCode: string | undefined;
  hasMore: boolean;
  initialized: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNativeHomeHistoryData({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}): INativeHomeHistoryData {
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
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const currencyMapRef = useRef(currencyMap);
  currencyMapRef.current = currencyMap;

  const [data, setData] = useState<IAccountHistoryTx[]>([]);
  const [addressMap, setAddressMap] = useState<Record<string, IAddressBadge>>(
    {},
  );
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
  const historyCoordinatorRef = useRef<
    HomeSectionCoordinator<IHomeHistoryLegacyPayload> | undefined
  >(undefined);
  const historySemanticRevisionRef = useRef(0);
  const networkId = network?.id;
  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const homeFactsShadow = useHomeFactsShadow();
  const homeHistorySemantic = useHomeSectionSemantic('history');
  const { clearSemanticSection, publishSemanticSection } =
    useHomeActions().current;
  const [historyProducerInstanceId] = useState(
    createNativeHomeHistoryProducerInstanceId,
  );

  const mergeDerive = Boolean(
    !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
    deriveInfoItems.length > 1 &&
    vaultSettings?.mergeDeriveAssetsEnabled,
  );
  const loadMoreEnabled =
    enabled && !network?.isAllNetworks && Boolean(networkId);
  const mergeAddressMap = useCallback(
    (nextAddressMap: Record<string, IAddressBadge>) => {
      setAddressMap((previous) => ({ ...previous, ...nextAddressMap }));
    },
    [],
  );

  const {
    appendedTxs,
    hasMore,
    isLoadingMore,
    loadMore,
    onFirstPageResponse,
    reset: resetLoadMore,
  } = useHistoryListLoadMore({
    enabled: loadMoreEnabled,
    accountId: account?.id ?? '',
    networkId: networkId ?? '',
    filterScam: settings.isFilterScamHistoryEnabled,
    filterLowValue: settings.isFilterLowValueHistoryEnabled,
    excludeTestNetwork: true,
    sourceCurrency: settings.currencyInfo.id,
    currencyMap,
    mergeDerive,
    indexedAccountId: indexedAccount?.id ?? '',
    onAddressMap: mergeAddressMap,
  });

  const ownerKey = useMemo(
    () =>
      [
        account?.id ?? '',
        indexedAccount?.id ?? '',
        networkId ?? '',
        wallet?.id ?? '',
        mergeDerive ? '1' : '0',
      ].join('|'),
    [account?.id, indexedAccount?.id, mergeDerive, networkId, wallet?.id],
  );
  const historySourceIdentity = useMemo(() => {
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
    const params: IHomeHistorySourceParams = {
      accountId: mergeDerive && indexedAccountId ? indexedAccountId : accountId,
      accountOwnerId: accountId,
      filterLowValue: settings.isFilterLowValueHistoryEnabled,
      filterScam: settings.isFilterScamHistoryEnabled,
      indexedAccountId,
      mergeDerive,
      networkId,
      networkMode: isAllNetworks ? 'allNetworks' : 'singleNetwork',
      sourceCurrencyId: settings.currencyInfo.id,
      walletId,
    };
    return createHomeHistorySourceIdentity({
      owner: homeFactsShadow.ownerToken,
      params,
      producerInstanceId: historyProducerInstanceId,
    });
  }, [
    accountId,
    enabled,
    historyProducerInstanceId,
    homeFactsShadow,
    indexedAccountId,
    isAllNetworks,
    mergeDerive,
    networkId,
    settings.currencyInfo.id,
    settings.isFilterLowValueHistoryEnabled,
    settings.isFilterScamHistoryEnabled,
    walletId,
  ]);
  const historySourceIdentityKey = useMemo(
    () =>
      historySourceIdentity
        ? stringUtils.stableStringify(historySourceIdentity)
        : undefined,
    [historySourceIdentity],
  );

  useEffect(() => {
    historySemanticRevisionRef.current = Math.max(
      historySemanticRevisionRef.current,
      homeHistorySemantic?.revision ?? 0,
    );
  }, [homeHistorySemantic?.revision]);

  const applyAuthoritativeHistoryPayload = useCallback(
    (
      resolution: IHomeSectionCoordinatorResolution<IHomeHistoryLegacyPayload>,
    ) => {
      if (resolution.authoritative.kind === 'none') {
        return;
      }
      setData(resolution.authoritative.data.data);
      setAddressMap(resolution.authoritative.data.addressMap);
      setInitialized(true);
    },
    [],
  );

  const publishHistoryEvidence = useCallback(
    ({
      evidence,
      requestSeq,
    }: {
      evidence: IHomeHistoryEvidence;
      requestSeq: number;
    }) => {
      if (!historySourceIdentity || !historySourceIdentityKey) {
        return undefined;
      }
      let coordinator = historyCoordinatorRef.current;
      if (!coordinator) {
        coordinator = new HomeSectionCoordinator<IHomeHistoryLegacyPayload>(
          historySourceIdentity,
        );
        historyCoordinatorRef.current = coordinator;
      } else {
        coordinator.setOwner(historySourceIdentity);
      }
      const resolution = coordinator.dispatch(
        adaptHomeHistorySourceSnapshot({
          identity: historySourceIdentity,
          snapshot: projectHomeHistorySectionSource({
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
      historySemanticRevisionRef.current += 1;
      publishSemanticSection({
        owner: historySourceIdentity.owner,
        revision: historySemanticRevisionRef.current,
        sectionId: 'history',
        value: resolution.semantic,
      });
      applyAuthoritativeHistoryPayload(resolution);
      return resolution;
    },
    [
      applyAuthoritativeHistoryPayload,
      historySourceIdentity,
      historySourceIdentityKey,
      publishSemanticSection,
    ],
  );

  useEffect(() => {
    if (historySourceIdentity && historySourceIdentityKey) {
      return;
    }
    historyCoordinatorRef.current = undefined;
    if (homeFactsShadow) {
      historySemanticRevisionRef.current += 1;
      clearSemanticSection({
        owner: homeFactsShadow.ownerToken,
        revision: historySemanticRevisionRef.current,
        sectionId: 'history',
      });
    }
  }, [
    clearSemanticSection,
    historySourceIdentity,
    historySourceIdentityKey,
    homeFactsShadow,
  ]);

  useEffect(
    () => () => {
      historyCoordinatorRef.current?.dispose();
    },
    [],
  );

  const load = useCallback(
    async (manual: boolean) => {
      if (!enabled || !networkId) {
        return;
      }
      const requestAccountId = mergeDerive ? indexedAccountId : accountId;
      if (!requestAccountId) {
        setData([]);
        setInitialized(true);
        return;
      }

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      publishHistoryEvidence({
        requestSeq: requestId,
        evidence: { kind: 'loading' },
      });
      try {
        const common = {
          networkId,
          isManualRefresh: manual,
          filterScam: settings.isFilterScamHistoryEnabled,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          excludeTestNetwork: true,
          sourceCurrency: settings.currencyInfo.id,
          currencyMap: currencyMapRef.current,
        };
        const result = mergeDerive
          ? await backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
              {
                ...common,
                indexedAccountId: requestAccountId,
              },
            )
          : await backgroundApiProxy.serviceHistory.fetchAccountHistory({
              ...common,
              accountId: requestAccountId,
            });
        if (requestIdRef.current === requestId) {
          const payload: IHomeHistoryLegacyPayload = {
            addressMap: result.addressMap ?? {},
            data: result.txs,
          };
          const rowIds = getHomeHistoryRowIds(payload);
          const resolution = publishHistoryEvidence({
            requestSeq: requestId,
            evidence: {
              kind: 'complete',
              confirmedEmpty: result.txs.length === 0,
              coverageFingerprint: buildHomeHistoryCoverage({
                requestSeq: requestId,
                rowCount: rowIds.length,
                source: isAllNetworks ? 'allNetworks' : 'singleNetwork',
              }),
              data: payload,
              rowIds,
            },
          });
          if (resolution?.accepted) {
            if (result.txs.length === 0) {
              setData([]);
              setAddressMap({});
            }
          } else if (!resolution) {
            setData(result.txs);
            setAddressMap(result.addressMap ?? {});
          }
          onFirstPageResponse({
            txs: result.txs,
            next: result.next,
            hasMore: !!result.hasMoreOnChainHistory,
            isIndexer: result.isIndexer,
          });
          setInitialized(true);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorCode('history_fetch_failed');
          setInitialized(true);
          publishHistoryEvidence({
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
      enabled,
      indexedAccountId,
      isAllNetworks,
      mergeDerive,
      networkId,
      settings.currencyInfo.id,
      settings.isFilterLowValueHistoryEnabled,
      settings.isFilterScamHistoryEnabled,
      onFirstPageResponse,
      publishHistoryEvidence,
    ],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setInitialized(false);
    const resolution = publishHistoryEvidence({
      requestSeq: requestId,
      evidence: { kind: 'loading' },
    });
    if (
      !resolution ||
      (resolution.accepted && resolution.authoritative.kind === 'none')
    ) {
      setData([]);
      setAddressMap({});
    }
    setErrorCode(undefined);
    resetLoadMore();
    if (enabled) {
      void load(false);
    }
  }, [enabled, load, ownerKey, publishHistoryEvidence, resetLoadMore]);

  useEffect(() => {
    if (!enabled || !visible) {
      return;
    }
    const refresh = () => {
      void load(false);
    };
    const refreshAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      refresh();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refreshAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refresh);
    const timer = setInterval(refresh, POLLING_INTERVAL_FOR_HISTORY);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refreshAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, refresh);
    };
  }, [enabled, load, visible]);

  const refresh = useCallback(() => load(true), [load]);

  const mergedData = useMemo(() => {
    if (appendedTxs.length === 0) return data;
    const firstPageIds = new Set(data.map((item) => item.id));
    return [
      ...data,
      ...appendedTxs.filter((item) => !firstPageIds.has(item.id)),
    ];
  }, [appendedTxs, data]);

  return useMemo(
    () => ({
      addressMap,
      data: mergedData,
      errorCode,
      hasMore,
      initialized,
      isLoadingMore,
      isRefreshing,
      loadMore,
      refresh,
    }),
    [
      addressMap,
      errorCode,
      hasMore,
      initialized,
      isLoadingMore,
      isRefreshing,
      loadMore,
      mergedData,
      refresh,
    ],
  );
}
